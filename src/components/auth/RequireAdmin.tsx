import { Navigate, Outlet } from "react-router-dom";

import { useUserRole } from "../../hooks/useUserRole";

/*
 * Verifies the authenticated user's role server-side (via RPC)
 * before allowing access to Admin-only routes.
 */
export default function RequireAdmin() {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Checking permissions...
        </p>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return (
      <Navigate
        to="/system"
        replace
      />
    );
  }

  return <Outlet />;
}
