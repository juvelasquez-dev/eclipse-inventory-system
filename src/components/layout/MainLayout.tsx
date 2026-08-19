import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type MainModule = "inventory" | "pos";

interface MainLayoutProps {
  module: MainModule;
}

export default function MainLayout({
  module,
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar
        module={module}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="min-w-0 flex-1">
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