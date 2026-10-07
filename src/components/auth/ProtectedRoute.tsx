import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useInactivityLogout } from "../../hooks/useInactivityLogout";
import { useToast } from "../../context/ToastContext";
import { useInventoryContext } from "../../context/InventoryContext";
import EclipseLoadingScreen from "../ui/EclipseLoadingScreen";

// How often an already-authenticated session rechecks account status,
// so an admin deactivating a user takes effect without a page reload.
const ACCOUNT_STATUS_POLL_INTERVAL_MS = 60 * 1000;
const MINIMUM_LOADING_SCREEN_DURATION_MS = 3 * 1000;

export default function ProtectedRoute() {
  const [loading, setLoading] =
    useState(true);

  const [authenticated, setAuthenticated] =
    useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] =
    useState<string | null>(null);
  const [minimumLoadingDurationElapsed, setMinimumLoadingDurationElapsed] =
    useState(true);
  const sessionEvaluationIdRef = useRef(0);
  const authEventReceivedRef = useRef(false);
  const currentAuthUserIdRef = useRef<string | null>(null);
  const minimumLoadingUserIdRef = useRef<string | null>(null);
  const minimumLoadingTimerRef = useRef<{
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  const { showToast } = useToast();
  const {
    isLoading: isOperationalDataLoading,
    loadError: operationalDataError,
    loadOperationalData,
    clearOperationalData,
    retryOperationalData,
  } = useInventoryContext();

  const clearMinimumLoadingTimer = useCallback(() => {
    if (minimumLoadingTimerRef.current) {
      clearTimeout(minimumLoadingTimerRef.current.timeoutId);
      minimumLoadingTimerRef.current = null;
    }

    minimumLoadingUserIdRef.current = null;
    setMinimumLoadingDurationElapsed(true);
  }, []);

  const startMinimumLoadingTimer = useCallback(
    (userId: string, restart = false) => {
      if (
        !restart &&
        minimumLoadingUserIdRef.current === userId
      ) {
        return;
      }

      if (minimumLoadingTimerRef.current) {
        clearTimeout(minimumLoadingTimerRef.current.timeoutId);
      }

      minimumLoadingUserIdRef.current = userId;
      setMinimumLoadingDurationElapsed(false);

      const timer = {
        timeoutId: setTimeout(() => {
          if (minimumLoadingTimerRef.current === timer) {
            minimumLoadingTimerRef.current = null;
            setMinimumLoadingDurationElapsed(true);
          }
        }, MINIMUM_LOADING_SCREEN_DURATION_MS),
      };
      minimumLoadingTimerRef.current = timer;
    },
    []
  );

  const retryOperationalDataWithMinimum = useCallback(async () => {
    if (authenticatedUserId) {
      startMinimumLoadingTimer(authenticatedUserId, true);
    }

    await retryOperationalData();
  }, [
    authenticatedUserId,
    retryOperationalData,
    startMinimumLoadingTimer,
  ]);

  useInactivityLogout(authenticated, () => {
    showToast(
      "Your session ended due to inactivity. Please log in again.",
      "error"
    );
  });

  useEffect(() => {
    let cancelled = false;

    async function evaluateSession(
      session: Session | null
    ) {
      if (cancelled) {
        return;
      }

      const currentEvaluationId =
        ++sessionEvaluationIdRef.current;
      const nextUserId = session?.user.id ?? null;

      if (nextUserId !== currentAuthUserIdRef.current) {
        currentAuthUserIdRef.current = nextUserId;
        clearMinimumLoadingTimer();
        setAuthenticatedUserId(null);
        clearOperationalData();
        setAuthenticated(false);
        setLoading(Boolean(session));
      }

      if (!session) {
        clearMinimumLoadingTimer();
        setAuthenticatedUserId(null);
        clearOperationalData();
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const { data: status, error } = await supabase.rpc(
        "get_current_user_status"
      );

      if (
        cancelled ||
        currentEvaluationId !==
        sessionEvaluationIdRef.current
      ) {
        return;
      }

      if (error || status !== "ACTIVE") {
        clearMinimumLoadingTimer();
        currentAuthUserIdRef.current = null;
        setAuthenticatedUserId(null);
        clearOperationalData();
        setAuthenticated(false);
        setLoading(false);
        await supabase.auth.signOut();
        return;
      }

      startMinimumLoadingTimer(session.user.id);
      setAuthenticatedUserId(session.user.id);
      void loadOperationalData(session.user.id);
      setAuthenticated(true);
      setLoading(false);
    }

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (!authEventReceivedRef.current) {
        await evaluateSession(session);
      }
    }

    authEventReceivedRef.current = false;

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          authEventReceivedRef.current = true;
          void evaluateSession(session);
        }
      );

    checkSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      sessionEvaluationIdRef.current += 1;
      if (minimumLoadingTimerRef.current) {
        clearTimeout(minimumLoadingTimerRef.current.timeoutId);
        minimumLoadingTimerRef.current = null;
      }
      minimumLoadingUserIdRef.current = null;
      currentAuthUserIdRef.current = null;
    };
  }, [
    clearMinimumLoadingTimer,
    clearOperationalData,
    loadOperationalData,
    startMinimumLoadingTimer,
  ]);

  useEffect(() => {
    if (!operationalDataError || !minimumLoadingTimerRef.current) {
      return;
    }

    clearTimeout(minimumLoadingTimerRef.current.timeoutId);
    minimumLoadingTimerRef.current = null;
  }, [operationalDataError]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const currentEvaluationId =
        sessionEvaluationIdRef.current;
      const { data: status, error } = await supabase.rpc(
        "get_current_user_status"
      );

      if (
        currentEvaluationId !==
        sessionEvaluationIdRef.current
      ) {
        return;
      }

      if (error || status !== "ACTIVE") {
        clearMinimumLoadingTimer();
        currentAuthUserIdRef.current = null;
        setAuthenticatedUserId(null);
        clearOperationalData();
        setAuthenticated(false);
        await supabase.auth.signOut();
      }
    }, ACCOUNT_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    authenticated,
    clearMinimumLoadingTimer,
    clearOperationalData,
  ]);

  if (loading) {
    return <EclipseLoadingScreen />;
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (
    operationalDataError ||
    isOperationalDataLoading ||
    (authenticatedUserId && !minimumLoadingDurationElapsed)
  ) {
    return (
      <EclipseLoadingScreen
        error={operationalDataError}
        onRetry={retryOperationalDataWithMinimum}
      />
    );
  }

  return <Outlet />;
}