import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

type ErrorInfo = {
  code: string;
  message: string;
  status: number | null;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getErrorInfo(error: unknown): ErrorInfo {
  if (typeof error === "object" && error !== null) {
    const values = error as Record<string, unknown>;
    return {
      code: typeof values.code === "string" ? values.code : "",
      message: typeof values.message === "string" ? values.message : "",
      status: typeof values.status === "number" ? values.status : null,
    };
  }

  return { code: "", message: "", status: null };
}

function isDuplicateEmail(error: unknown) {
  const info = getErrorInfo(error);
  const message = info.message.toLowerCase();
  return info.code.toLowerCase().includes("email_exists") ||
    info.code.toLowerCase().includes("user_already_exists") ||
    message.includes("already registered") ||
    message.includes("already exists");
}

function authCreationErrorResponse(error: unknown) {
  const { code, message, status } = getErrorInfo(error);

  if (status !== null && status >= 500) {
    return jsonResponse({ pending: true }, 202);
  }

  if (isDuplicateEmail(error)) {
    return jsonResponse({ error: "An account with that email already exists." }, 409);
  }

  const normalizedMessage = message.toLowerCase();
  const knownPasswordCodes = ["weak_password", "password_too_short"];
  const knownValidationCodes = ["validation_failed", "email_address_invalid"];

  if (
    knownPasswordCodes.includes(code.toLowerCase()) ||
    ((status === 400 || status === 422) && normalizedMessage.includes("password"))
  ) {
    return jsonResponse({ error: "The temporary password does not meet Auth requirements." }, 400);
  }

  if (
    knownValidationCodes.includes(code.toLowerCase()) ||
    ((status === 400 || status === 422) && /email.*(invalid|valid)/i.test(message))
  ) {
    return jsonResponse({ error: "The Auth service rejected the email address." }, 400);
  }

  return jsonResponse({ pending: true }, 202);
}

function isDefinitiveDatabaseError(error: unknown) {
  const { code } = getErrorInfo(error);
  return /^[0-9A-Z]{5}$/.test(code) && !code.startsWith("PGRST");
}

function databaseErrorResponse(error: unknown) {
  const { code, message } = getErrorInfo(error);
  const normalizedMessage = message.toLowerCase();

  if (code === "23505" || normalizedMessage.includes("username already exists")) {
    return jsonResponse({ error: "That username is already in use." }, 409);
  }

  if (normalizedMessage.includes("email already has a user profile")) {
    return jsonResponse({ error: "That email is already linked to a user profile." }, 409);
  }

  if (code === "42501") {
    return jsonResponse({ error: "An active admin account is required." }, 403);
  }

  return jsonResponse({ error: "Unable to complete user creation. Verify the details and try again." }, 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function creationCommitted(
  serviceClient: ReturnType<typeof createClient>,
  authUserId: string,
  username: string,
  email: string,
  role: string,
  status: string,
  area: string,
) {
  const { data: profile, error: profileError } = await serviceClient
    .from("users")
    .select("id, username, email, role, status")
    .eq("username", username)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.username !== username ||
    profile.email?.trim().toLowerCase() !== email ||
    profile.role !== role ||
    profile.status !== status
  ) {
    return false;
  }

  const [assignmentResult, auditResult] = await Promise.all([
    serviceClient
      .from("user_area_assignments")
      .select("area_code")
      .eq("user_id", authUserId)
      .maybeSingle(),
    serviceClient
      .from("audit_logs")
      .select("id")
      .eq("action", "USER_CREATED")
      .eq("target_user_id", profile.id)
      .eq("target_username", username)
      .limit(1),
  ]);

  return !assignmentResult.error &&
    assignmentResult.data?.area_code === area &&
    !auditResult.error &&
    (auditResult.data?.length ?? 0) > 0;
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "User creation is not configured." }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }

  const { error: adminError } = await callerClient.rpc("require_active_admin");
  if (adminError) {
    return jsonResponse({ error: "An active admin account is required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = await request.json();
    if (!isRecord(parsedBody)) {
      return jsonResponse({ error: "Invalid request." }, 400);
    }
    body = parsedBody;
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const temporaryPassword = typeof body.temporaryPassword === "string"
    ? body.temporaryPassword
    : "";
  const role = body.role;
  const area = body.area;
  const status = body.status;

  if (!username) {
    return jsonResponse({ error: "Username is required." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  if (temporaryPassword.length < 8) {
    return jsonResponse({ error: "Temporary passwords must be at least 8 characters." }, 400);
  }

  if (role !== "ADMIN" && role !== "STAFF") {
    return jsonResponse({ error: "Select a valid role." }, 400);
  }

  if (area !== "IAO" && area !== "CBR" && area !== "EFT") {
    return jsonResponse({ error: "Select a valid area." }, 400);
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    return jsonResponse({ error: "Select a valid status." }, 400);
  }

  const { data: existingProfile, error: usernameCheckError } = await serviceClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (usernameCheckError) {
    return jsonResponse({ error: "Unable to verify username availability." }, 500);
  }

  if (existingProfile) {
    return jsonResponse({ error: "That username is already in use." }, 409);
  }

  let authCreation: Awaited<ReturnType<typeof serviceClient.auth.admin.createUser>>;

  try {
    authCreation = await serviceClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username },
    });
  } catch {
    return jsonResponse({
      error: "Auth account creation could not be confirmed. Verify whether this email has an account before retrying.",
    }, 503);
  }

  const { data: authResult, error: authCreateError } = authCreation;

  if (authCreateError) {
    return authCreationErrorResponse(authCreateError);
  }

  if (!authResult?.user) {
    return jsonResponse({ pending: true }, 202);
  }

  const authUserId = authResult.user.id;

  try {
    const { error: profileError } = await serviceClient.rpc(
      "admin_create_user_profile",
      {
        p_actor_auth_user_id: callerData.user.id,
        p_auth_user_id: authUserId,
        p_username: username,
        p_role: role,
        p_status: status,
        p_area_code: area,
      }
    );

    if (!profileError) {
      return jsonResponse({ success: true }, 201);
    }

    if (!isDefinitiveDatabaseError(profileError)) {
      const committed = await creationCommitted(
        serviceClient,
        authUserId,
        username,
        email,
        role,
        status,
        area
      ).catch(() => false);

      if (committed) {
        return jsonResponse({ success: true }, 201);
      }

      return jsonResponse({ pending: true }, 202);
    }

    const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(authUserId);
    if (cleanupError) {
      return jsonResponse({
        error: "Profile creation failed and Auth cleanup could not be confirmed. Contact an administrator before retrying.",
      }, 500);
    }

    return databaseErrorResponse(profileError);
  } catch {
    const committed = await creationCommitted(
      serviceClient,
      authUserId,
      username,
      email,
      role,
      status,
      area
    ).catch(() => false);

    if (committed) {
      return jsonResponse({ success: true }, 201);
    }

    return jsonResponse({ pending: true }, 202);
  }
}

Deno.serve((request) =>
  handleRequest(request).catch(() =>
    jsonResponse({ error: "Internal server error." }, 500)
  )
);