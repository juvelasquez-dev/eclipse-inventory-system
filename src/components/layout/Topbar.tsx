import { Menu, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({
  onMenuClick,
}: TopbarProps) {
  const navigate = useNavigate();

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

        <h2 className="truncate font-semibold text-slate-700">
          Inventory Management
        </h2>

      </div>

      <div className="flex shrink-0 items-center gap-3">

        <span className="hidden text-sm text-slate-500 sm:block">
          Admin
        </span>

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