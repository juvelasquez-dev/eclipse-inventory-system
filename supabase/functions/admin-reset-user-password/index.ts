import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type PasswordResetTarget = {
  auth_user_id: string;
  username: string;
  role: string;
  status: string;
};

function getCorsHeaders(origin: string | null) {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function handleRequest(request: Request) {
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, corsHeaders);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return jsonResponse({ error: "Authentication is required." }, 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Password reset is not configured." }, 500, corsHeaders);
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
    return jsonResponse({ error: "Authentication is required." }, 401, corsHeaders);
  }

  const { error: adminError } = await callerClient.rpc("require_active_admin");
  if (adminError) {
    return jsonResponse({ error: "An active admin account is required." }, 403, corsHeaders);
  }

  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = await request.json();
    if (!isRecord(parsedBody)) {
      return jsonResponse({ error: "Invalid request." }, 400, corsHeaders);
    }
    body = parsedBody;
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400, corsHeaders);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const temporaryPassword =
    typeof body.temporaryPassword === "string" ? body.temporaryPassword : "";

  if (!username || username.length > 255) {
    return jsonResponse({ error: "Enter a valid username." }, 400, corsHeaders);
  }

  if (!temporaryPassword || temporaryPassword.length < 8) {
    return jsonResponse(
      { error: "Temporary passwords must be at least 8 characters." },
      400,
      corsHeaders,
    );
  }

  const { data: targetRows, error: targetError } = await serviceClient.rpc(
    "admin_resolve_password_reset_target",
    { p_username: username },
  );

  if (targetError || !Array.isArray(targetRows) || targetRows.length !== 1) {
    return jsonResponse(
      { error: "Unable to verify the target account." },
      404,
      corsHeaders,
    );
  }

  const target = targetRows[0] as PasswordResetTarget;
  if (
    typeof target.auth_user_id !== "string" ||
    target.username !== username ||
    !["ADMIN", "STAFF"].includes(target.role) ||
    !["ACTIVE", "INACTIVE"].includes(target.status)
  ) {
    return jsonResponse(
      { error: "Unable to verify the target account." },
      404,
      corsHeaders,
    );
  }

  if (target.auth_user_id === callerData.user.id) {
    return jsonResponse(
      { error: "Use Change My Password for your own account." },
      400,
      corsHeaders,
    );
  }

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    target.auth_user_id,
    { password: temporaryPassword },
  );

  if (updateError) {
    const errorDetails = updateError as { code?: string; message?: string };
    const code = errorDetails.code?.toLowerCase() ?? "";
    const message = errorDetails.message?.toLowerCase() ?? "";

    if (
      code === "weak_password" ||
      code === "password_too_short" ||
      message.includes("password")
    ) {
      return jsonResponse(
        { error: "The new password does not meet Auth requirements." },
        400,
        corsHeaders,
      );
    }

    return jsonResponse(
      { error: "Unable to reset the password. Please try again." },
      500,
      corsHeaders,
    );
  }

  const { error: auditError } = await serviceClient.rpc("admin_log_password_reset", {
    p_actor_auth_user_id: callerData.user.id,
    p_target_auth_user_id: target.auth_user_id,
    p_target_username: target.username,
  });

  if (auditError) {
    return jsonResponse(
      {
        error:
          "The password was reset, but the audit event could not be recorded. Contact an administrator.",
      },
      500,
      corsHeaders,
    );
  }

  return jsonResponse({ success: true }, 200, corsHeaders);
}

Deno.serve((request) =>
  handleRequest(request).catch(() =>
    jsonResponse(
      { error: "Unable to process the password reset request." },
      500,
      getCorsHeaders(request.headers.get("Origin")),
    )
  )
);
