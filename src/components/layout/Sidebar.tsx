import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardPenLine,
  Boxes,
  History,
  ShoppingCart,
  Store,
  FileText,
  X,
} from "lucide-react";

import { NavLink } from "react-router-dom";

type SidebarModule =
  | "inventory"
  | "pos"
  | "outlets";

interface MenuItem {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
}

const inventoryMenuItems: MenuItem[] = [
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

const posMenuItems: MenuItem[] = [
  {
    name: "Point of Sale",
    path: "/pos",
    icon: ShoppingCart,
  },
  {
    name: "Sales History",
    path: "/pos/history",
    icon: History,
  },
];

const outletsMenuItems: MenuItem[] = [
  {
    name: "Dashboard",
    path: "/outlets/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Outlets Management",
    path: "/outlets",
    icon: Store,
  },
  {
    name: "Reports",
    path: "/outlets/reports",
    icon: FileText,
  },
];

interface SidebarProps {
  module: SidebarModule;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  module,
  open,
  onClose,
}: SidebarProps) {
  const isPOS = module === "pos";
  const isOutlets = module === "outlets";

  const menuItems = isPOS
    ? posMenuItems
    : isOutlets
      ? outletsMenuItems
      : inventoryMenuItems;

  const systemName = isPOS
    ? "POS System"
    : isOutlets
      ? "Outlet Management"
      : "Inventory System";

  const footerDescription = isPOS
    ? "Point of Sale"
    : isOutlets
      ? "Outlet Management"
      : "Inventory Management";

  const accentColor = isPOS
    ? "emerald"
    : isOutlets
      ? "fuchsia"
      : "emerald";

  const getAccentClasses = (isActive: boolean) => {
    if (accentColor === "fuchsia") {
      return isActive
        ? "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200"
        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900";
    }
    return isActive
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900";
  };

  const getAccentIconColor = (isActive: boolean) => {
    if (accentColor === "fuchsia") {
      return isActive ? "text-fuchsia-600" : "text-slate-500 group-hover:text-slate-700";
    }
    return isActive ? "text-emerald-600" : "text-slate-500 group-hover:text-slate-700";
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex w-64 flex-col
          border-r border-slate-200/70
          bg-white/80 backdrop-blur-sm
          transition-transform duration-200
          md:static md:z-auto md:translate-x-0
          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-all duration-300 ${
              accentColor === "fuchsia"
                ? "bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-fuchsia-900/20"
                : "bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-900/20"
            }`}>
              {isPOS ? (
                <ShoppingCart size={18} />
              ) : isOutlets ? (
                <Store size={18} />
              ) : (
                <Boxes size={18} />
              )}
            </div>

            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900">
                Eclipse
              </h1>

              <p className="text-xs text-slate-600">
                {systemName}
              </p>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
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
                  onClick={onClose}
                  end={
                    item.path === "/" ||
                    item.path === "/pos" ||
                    item.path === "/outlets" ||
                    item.path === "/outlets/dashboard" ||
                    item.path === "/outlets/reports"
                  }
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      getAccentClasses(isActive)
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={18}
                        strokeWidth={2}
                        className={getAccentIconColor(isActive)}
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
        <div className="border-t border-slate-200/70 px-5 py-4">
          <p className="text-xs font-medium text-slate-700">
            Eclipse {systemName}
          </p>

          <p className="mt-1 text-[11px] text-slate-600">
            {footerDescription}
          </p>
        </div>
      </aside>
    </>
  );
}