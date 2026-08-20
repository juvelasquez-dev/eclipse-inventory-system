import {
  ArrowLeft,
  Menu,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  const [username, setUsername] =
    useState("User");
  const [areaCode, setAreaCode] =
    useState("");

  const title =
    module === "pos"
      ? "Point of Sale"
      : "Inventory Management";

  useEffect(() => {
    async function loadUserIdentity() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      const metadataUsername =
        user.user_metadata?.username ||
        user.user_metadata?.user_name;

      setUsername(
        metadataUsername ||
          user.email?.split("@")[0] ||
          "User"
      );

      const { data, error } = await supabase
        .from("user_area_assignments")
        .select("area_code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Unable to load user area assignment:",
          error
        );
        return;
      }

      setAreaCode(data?.area_code || "");
    }

    void loadUserIdentity();
  }, []);

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
        {/* User identity */}
        <span className="max-w-[9rem] truncate text-xs text-slate-500 sm:max-w-[16rem] sm:text-sm">
          <span aria-hidden="true">&#128100;</span>{" "}
          {username}
          {areaCode && (
            <>
              <span className="mx-1.5 text-slate-300">•</span>
              {areaCode}
            </>
          )}
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