import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type MainModule =
  | "inventory"
  | "pos"
  | "outlets";

interface MainLayoutProps {
  module: MainModule;
}

export default function MainLayout({
  module,
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-[#FBF9F4]">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-200/30 via-emerald-100/20 to-transparent blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-gradient-to-bl from-amber-200/30 via-orange-100/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-gradient-to-tr from-fuchsia-200/20 via-purple-100/15 to-transparent blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "radial-gradient(#0f172a 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
      </div>

      <Sidebar
        module={module}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="relative min-w-0 flex-1">
        <Topbar
          module={module}
          onMenuClick={() =>
            setSidebarOpen(true)
          }
        />

        <main className="p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}