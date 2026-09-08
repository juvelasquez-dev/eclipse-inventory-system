import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// Production value must stay at 15 minutes. For local testing only, temporarily
// change this to something small (e.g. 30 * 1000 for 30 seconds), verify the
// behavior, then restore it to 15 * 60 * 1000 before committing.
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const LAST_ACTIVITY_STORAGE_KEY = "eclipse-last-activity";
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
] as const;

/**
 * Signs the user out via the existing Supabase session after a period of
 * inactivity. Activity is tracked without triggering React re-renders, and
 * is synchronized across tabs using a localStorage timestamp.
 */
export function useInactivityLogout(
  enabled: boolean,
  onTimeout?: () => void
) {
  const timerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleTimeout() {
      clearTimer();
      timerRef.current = window.setTimeout(
        handleTimeout,
        INACTIVITY_TIMEOUT_MS
      );
    }

    async function handleTimeout() {
      clearTimer();
      await supabase.auth.signOut();
      onTimeoutRef.current?.();
    }

    function recordActivity(broadcast: boolean) {
      const now = Date.now();

      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastActivityRef.current = now;
      scheduleTimeout();

      if (broadcast) {
        try {
          window.localStorage.setItem(
            LAST_ACTIVITY_STORAGE_KEY,
            String(now)
          );
        } catch {
          // localStorage may be unavailable (e.g. private browsing); ignore.
        }
      }
    }

    function handleActivity() {
      recordActivity(true);
    }

    // Another tab reported activity, so this tab's timer should reset too.
    function handleStorage(event: StorageEvent) {
      if (event.key !== LAST_ACTIVITY_STORAGE_KEY || !event.newValue) {
        return;
      }

      lastActivityRef.current = Number(event.newValue);
      scheduleTimeout();
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    window.addEventListener("storage", handleStorage);

    scheduleTimeout();

    return () => {
      clearTimer();
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [enabled]);
}
