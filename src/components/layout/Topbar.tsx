import {
  ArrowLeft,
  Menu,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";

type TopbarModule = "inventory" | "pos";

interface TopbarProps {
  module: TopbarModule;
  onMenuClick: () => void;
}

export default function Topbar({
  module,
  onMenuClick,
}: TopbarProps) {
  const navigate = useNavigate();

  const title =
    module === "pos"
      ? "Point of Sale"
      : "Inventory Management";

  async function handleLogout() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout failed:",
        error
      );
      return;
    }

    navigate("/login", {
      replace: true,
    });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4 md:px-6">
      {/* Left side */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
        >
          <Menu size={22} />
        </button>

        {/* Back to system selection */}
        <button
          type="button"
          onClick={() => navigate("/system")}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:px-3"
        >
          <ArrowLeft size={16} />
          <span>Back to Systems</span>
        </button>

        {/* Module title */}
        <h2 className="truncate font-semibold text-slate-700">
          {title}
        </h2>
      </div>

      {/* Right side */}
      <div className="flex shrink-0 items-center gap-3">
        {/* User role */}
        <span className="hidden text-sm text-slate-500 sm:block">
          Admin
        </span>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut size={16} />

          <span className="hidden sm:inline">
            Logout
          </span>
        </button>
      </div>
    </header>
  );
}