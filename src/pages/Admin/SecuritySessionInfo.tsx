import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useUserArea } from "../../hooks/useUserArea";
import { INACTIVITY_TIMEOUT_MS } from "../../hooks/useInactivityLogout";
import { useUserRole } from "../../hooks/useUserRole";
import { supabase } from "../../lib/supabase";

type SessionStatus = "active" | "inactive" | "unavailable";

interface SecurityData {
  user: User | null;
  session: Session | null;
  username: string | null;
  accountStatus: "ACTIVE" | "INACTIVE" | null;
  sessionStatus: SessionStatus;
  loading: boolean;
  errors: string[];
}

function formatTimestamp(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-PH");
}

function InfoRow({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="min-w-0 border-b border-slate-100 py-3 last:border-b-0 sm:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">
        {value}
      </dd>
      {description && (
        <dd className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </dd>
      )}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default function SecuritySessionInfo() {
  const navigate = useNavigate();
  const { role, loading: roleLoading, error: roleError } = useUserRole();
  const { areaCode, loading: areaLoading, error: areaError } = useUserArea();
  const [securityData, setSecurityData] = useState<SecurityData>({
    user: null,
    session: null,
    username: null,
    accountStatus: null,
    sessionStatus: "unavailable",
    loading: true,
    errors: [],
  });

  useEffect(() => {
    let isMounted = true;

    async function loadSecurityData() {
      try {
        const [
          { data: userData, error: userError },
          { data: sessionData, error: sessionError },
          { data: username, error: usernameError },
          { data: accountStatus, error: statusError },
        ] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
          supabase.rpc("get_current_username"),
          supabase.rpc("get_current_user_status"),
        ]);

        if (!isMounted) {
          return;
        }

        const errors: string[] = [];
        if (userError) errors.push(`Unable to verify the authenticated user: ${userError.message}`);
        if (sessionError) errors.push(`Unable to check the current session: ${sessionError.message}`);
        if (usernameError) errors.push(`Unable to load the account username: ${usernameError.message}`);
        if (statusError) errors.push(`Unable to load the account status: ${statusError.message}`);

        const user = userError ? null : userData.user;
        const session = sessionError ? null : sessionData.session;
        const sessionStatus: SessionStatus = sessionError
          ? "unavailable"
          : !session
            ? "inactive"
            : userError || !user || session.user.id !== user.id
              ? "unavailable"
              : "active";

        setSecurityData({
          user,
          session,
          username:
            !usernameError && typeof username === "string" && username.trim()
              ? username.trim()
              : null,
          accountStatus:
            !statusError && (accountStatus === "ACTIVE" || accountStatus === "INACTIVE")
              ? accountStatus
              : null,
          sessionStatus,
          loading: false,
          errors,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("Unable to load security and session information:", error);
        setSecurityData({
          user: null,
          session: null,
          username: null,
          accountStatus: null,
          sessionStatus: "unavailable",
          loading: false,
          errors: ["Unable to load security and session information. Please try again."],
        });
      }
    }

    void loadSecurityData();

    return () => {
      isMounted = false;
    };
  }, []);

  const loading =
    securityData.loading || roleLoading || areaLoading;
  const errors = [
    ...securityData.errors,
    ...(roleError ? [`Unable to load the account role: ${roleError}`] : []),
    ...(areaError ? [`Unable to load the assigned area: ${areaError}`] : []),
  ];
  const inactivityMinutes = Math.floor(INACTIVITY_TIMEOUT_MS / 60_000);
  const sessionStatusLabel =
    securityData.sessionStatus === "active"
      ? "Active"
      : securityData.sessionStatus === "inactive"
        ? "Inactive"
        : "Not available";

  return (
    <div className="min-h-screen bg-[#FBF9F4]">
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/70 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          <span>Back to Administration</span>
        </button>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 flex items-start gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 sm:h-12 sm:w-12">
            <ShieldCheck size={23} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Security &amp; Session Information
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Review your EIDMS account details and the session in this browser.
            </p>
          </div>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-medium">
              Some information could not be loaded. Unavailable values are shown explicitly below.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {loading && (
          <div className="mb-5 flex items-center gap-2 text-sm text-slate-500" role="status">
            <Loader2 size={16} className="animate-spin" />
            Loading account and session information...
          </div>
        )}

        <div className="space-y-5">
          <InfoCard title="EIDMS Account">
            <p className="mt-1 text-sm text-slate-500">
              Profile information maintained by EIDMS.
            </p>
            <dl className="mt-4 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <InfoRow
                label="Username"
                value={loading ? "Loading..." : securityData.username ?? "Not available"}
              />
              <InfoRow
                label="Role"
                value={loading ? "Loading..." : role ?? "Not available"}
              />
              <InfoRow
                label="Assigned Area"
                value={loading ? "Loading..." : areaCode ?? "Not available"}
              />
              <InfoRow
                label="Account Status"
                value={loading ? "Loading..." : securityData.accountStatus ?? "Not available"}
              />
            </dl>
          </InfoCard>

          <InfoCard title="Supabase Auth & Current Session">
            <p className="mt-1 text-sm text-slate-500">
              Auth and session details below apply only to this browser.
            </p>
            <dl className="mt-4 grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <InfoRow
                label="Email"
                value={loading ? "Loading..." : securityData.user?.email ?? "Not available"}
              />
              <InfoRow label="Authentication Method" value="Email & Password" />
              <InfoRow
                label="Session Status"
                value={loading ? "Loading..." : sessionStatusLabel}
              />
              <InfoRow
                label="Last Sign-In"
                value={
                  loading
                    ? "Loading..."
                    : formatTimestamp(securityData.user?.last_sign_in_at)
                }
                description="Latest sign-in recorded for this account by Supabase Auth."
              />
              <InfoRow
                label="Access Token Expires"
                value={
                  loading
                    ? "Loading..."
                    : securityData.sessionStatus === "active"
                      ? formatTimestamp(securityData.session?.expires_at)
                      : "Not available"
                }
              />
              <InfoRow
                label="Inactivity Logout"
                value={`${inactivityMinutes} minutes of inactivity`}
              />
            </dl>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              Access-token expiry may change when Supabase refreshes the token. The inactivity logout is an EIDMS client-side setting, not a server-side session or token expiry.
            </p>
          </InfoCard>

          <aside className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm sm:px-5">
            Session information is limited to data currently available to EIDMS and Supabase Auth. EIDMS does not currently collect or display device, IP address, browser, operating system, or geographic location information.
          </aside>
        </div>
      </main>
    </div>
  );
}
