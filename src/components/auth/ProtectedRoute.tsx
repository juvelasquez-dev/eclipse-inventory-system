import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useInactivityLogout } from "../../hooks/useInactivityLogout";
import { useToast } from "../../context/ToastContext";

// How often an already-authenticated session rechecks account status,
// so an admin deactivating a user takes effect without a page reload.
const ACCOUNT_STATUS_POLL_INTERVAL_MS = 60 * 1000;

export default function ProtectedRoute() {
  const [loading, setLoading] =
    useState(true);

  const [authenticated, setAuthenticated] =
    useState(false);

  const { showToast } = useToast();

  useInactivityLogout(authenticated, () => {
    showToast(
      "Your session ended due to inactivity. Please log in again.",
      "error"
    );
  });

  useEffect(() => {
    async function evaluateSession(
      session: Session | null
    ) {
      if (!session) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const { data: status, error } = await supabase.rpc(
        "get_current_user_status"
      );

      if (error || status === "INACTIVE") {
        await supabase.auth.signOut();
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      setLoading(false);
    }

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await evaluateSession(session);
    }

    checkSession();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          void evaluateSession(session);
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const { data: status, error } = await supabase.rpc(
        "get_current_user_status"
      );

      if (error || status === "INACTIVE") {
        await supabase.auth.signOut();
        setAuthenticated(false);
      }
    }, ACCOUNT_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authenticated]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Checking session...
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
}