import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";

export type UserRole = "ADMIN" | "STAFF" | null;

interface UseUserRoleResult {
  role: UserRole;
  loading: boolean;
}

/*
 * Fetches the current authenticated user's role
 * via the get_current_user_role RPC (public.users.role).
 */
export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      const { data, error } = await supabase.rpc(
        "get_current_user_role"
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(
          "Unable to load user role:",
          error
        );
        setRole(null);
        setLoading(false);
        return;
      }

      setRole(
        typeof data === "string"
          ? (data as UserRole)
          : null
      );
      setLoading(false);
    }

    void loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  return { role, loading };
}
