import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import { MaintenanceRefreshContext } from "../../context/MaintenanceContext";
import { fetchAdminMaintenance, fetchMaintenanceStatus } from "../../lib/maintenance";
import { supabase } from "../../lib/supabase";
import Login from "../../pages/Login/Login";
import SystemMaintenance from "../../pages/Admin/SystemMaintenance";
import { useInactivityLogout } from "../../hooks/useInactivityLogout";
import {
  createSerialRefresh,
  formatManilaTimestamp,
  type MaintenanceStatus,
} from "../../utils/maintenance";
import EclipseLoadingScreen from "../ui/EclipseLoadingScreen";

type StatusState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; status: MaintenanceStatus };

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StatusState>({ kind: "loading" });
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    const checker = createSerialRefresh(
      fetchMaintenanceStatus,
      (status) => setState({ kind: "ready", status }),
      (error) => {
        console.error("Unable to verify maintenance status:", error);
        setState({ kind: "error" });
      },
    );
    refreshRef.current = checker.refresh;
    checker.refresh();
    const interval = window.setInterval(checker.refresh, 30000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") checker.refresh();
    };
    window.addEventListener("focus", checker.refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checker.refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      checker.dispose();
      refreshRef.current = () => {};
    };
  }, []);

  if (state.kind === "loading") return <EclipseLoadingScreen />;
  if (state.kind === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FBF9F4] p-6">
        <div role="alert" className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
          <h1 className="text-xl font-bold">Unable to verify system status</h1>
          <p className="mt-3 text-slate-600">Check your connection and try again. Access is temporarily unavailable.</p>
          <button type="button" onClick={refresh} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-white">Retry</button>
        </div>
      </main>
    );
  }

  return (
    <MaintenanceRefreshContext.Provider value={refresh}>
      {state.status.enabled ? (
        <BrowserRouter>
          <MaintenanceSession>
            <Routes>
              <Route path="/maintenance/login" element={<Login maintenance />} />
              <Route path="/admin/maintenance" element={<RestrictedAdmin />} />
              <Route path="*" element={<MaintenanceScreen status={state.status} />} />
            </Routes>
          </MaintenanceSession>
        </BrowserRouter>
      ) : children}
    </MaintenanceRefreshContext.Provider>
  );
}

function MaintenanceSession({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  useInactivityLogout(signedIn);

  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      eventReceived = true;
      setSignedIn(Boolean(session));
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return;
      if (error) {
        console.error("Unable to check maintenance session:", error);
        return;
      }
      setSignedIn(Boolean(data.session));
    }).catch((error: unknown) => {
      if (active && !eventReceived) console.error("Unable to check maintenance session:", error);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return children;
}

function MaintenanceScreen({ status }: { status: MaintenanceStatus }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FBF9F4] p-6">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow">
        <p className="text-sm font-semibold text-indigo-600">Eclipse EIDMS</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">System maintenance</h1>
        <p className="mt-4 whitespace-pre-wrap text-slate-600">
          {status.announcement || "The system is temporarily unavailable while maintenance is in progress."}
        </p>
        {status.expected_end_at && (
          <p className="mt-4 text-sm text-slate-600">
            Expected return: {formatManilaTimestamp(status.expected_end_at)} (Asia/Manila)
          </p>
        )}
        <Link to="/admin/maintenance" className="mt-6 inline-block text-sm font-medium text-indigo-700 underline">
          Administrator access
        </Link>
      </section>
    </main>
  );
}

function RestrictedAdmin() {
  const [session, setSession] = useState<{ userId: string; token: string } | null | undefined>(undefined);
  const [access, setAccess] = useState<{
    kind: "checking" | "allowed" | "denied" | "error";
    session?: typeof session;
  }>({ kind: "checking" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      setAccess({ kind: "checking" });
      setSession(session ? { userId: session.user.id, token: session.access_token } : null);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return;
      if (error) {
        console.error("Unable to check administrator session:", error);
        setAccess({ kind: "error" });
        return;
      }
      setSession(data.session ? { userId: data.session.user.id, token: data.session.access_token } : null);
    }).catch((error: unknown) => {
      if (!active || eventReceived) return;
      console.error("Unable to check administrator session:", error);
      setAccess({ kind: "error" });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [retry]);

  useEffect(() => {
    if (!session) return;
    const checker = createSerialRefresh(
      fetchAdminMaintenance,
      () => setAccess({ kind: "allowed", session }),
      (error) => {
        if (
          error && typeof error === "object" &&
          "code" in error && error.code === "P0001" &&
          "message" in error && error.message === "Access denied: active admin role required"
        ) {
          setAccess({ kind: "denied", session });
        } else {
          console.error("Unable to verify administrator access:", error);
          setAccess({ kind: "error", session });
        }
      },
    );
    checker.refresh();
    const interval = window.setInterval(checker.refresh, 30000);
    window.addEventListener("focus", checker.refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checker.refresh);
      checker.dispose();
    };
  }, [session, retry]);

  if (session === undefined && access.kind !== "error") return <EclipseLoadingScreen />;
  if (session && (access.kind === "checking" || access.session !== session)) return <EclipseLoadingScreen />;
  if (session && access.kind === "allowed") return <SystemMaintenance restricted />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FBF9F4] p-6">
      <section className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
        <h1 className="text-xl font-bold">
          {access.kind === "error" ? "Unable to verify administrator access" : "Active administrator access required"}
        </h1>
        <p className="mt-3 text-slate-600">
          {access.kind === "error" ? "Check your connection and try again." : "Sign in with an active administrator account to manage maintenance."}
        </p>
        {access.kind === "error" && (
          <button type="button" onClick={() => { setSession(undefined); setAccess({ kind: "checking" }); setRetry((value) => value + 1); }} className="mt-5 mr-4 text-indigo-700 underline">Retry</button>
        )}
        <Link to="/maintenance/login" className="mt-5 inline-block text-indigo-700 underline">Administrator sign-in</Link>
        <Link to="/" className="mt-5 ml-4 inline-block text-slate-600 underline">Back</Link>
      </section>
    </main>
  );
}
