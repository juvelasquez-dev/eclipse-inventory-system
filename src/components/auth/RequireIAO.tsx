import { Navigate, Outlet } from "react-router-dom";

import { useUserArea } from "../../hooks/useUserArea";

export default function RequireIAO() {
  const { areaCode, loading } = useUserArea();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Checking permissions...
        </p>
      </div>
    );
  }

  if (areaCode !== "IAO") {
    return <Navigate to="/system" replace />;
  }

  return <Outlet />;
}
