import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardPenLine,
  Boxes,
  History,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const menuItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Products",
    path: "/products",
    icon: Package,
  },
  {
    name: "Stock In",
    path: "/stock-in",
    icon: ArrowDownToLine,
  },
  {
    name: "Stock Out",
    path: "/stock-out",
    icon: ArrowUpFromLine,
  },
  {
  name: "Stock Adjustment",
  path: "/stock-adjustment",
  icon: ClipboardPenLine,
},
  {
    name: "Inventory",
    path: "/inventory",
    icon: Boxes,
  },
  {
    name: "History",
    path: "/history",
    icon: History,
  },
];

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-slate-800 bg-slate-900">
      {/* Logo / Brand */}
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-white to-slate-200 text-slate-900 shadow-sm shadow-black/20">
            <Boxes size={20} />
          </div>

          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">
              Eclipse
            </h1>

            <p className="text-xs text-slate-400">
              Inventory System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Main Menu
        </p>

        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white" />
                    )}

                    <Icon
                      size={18}
                      strokeWidth={2}
                      className={
                        isActive
                          ? "text-white"
                          : "text-slate-500 transition-colors group-hover:text-slate-200"
                      }
                    />

                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-6 py-4">
        <p className="text-xs font-medium text-slate-400">
          Eclipse Inventory System
        </p>

        <p className="mt-1 text-[11px] text-slate-500">
          Inventory Management
        </p>
      </div>
    </aside>
  );
}