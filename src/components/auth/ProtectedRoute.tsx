import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useInactivityLogout } from "../../hooks/useInactivityLogout";
import { useToast } from "../../context/ToastContext";

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
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setAuthenticated(
        !!session
      );

      setLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          setAuthenticated(
            !!session
          );

          setLoading(false);
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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