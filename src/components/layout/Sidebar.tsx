import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardPenLine,
  Boxes,
  History,
  ShoppingCart,
  ArrowLeft,
  X,
} from "lucide-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

type SidebarModule = "inventory" | "pos";

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
  const navigate = useNavigate();

  const isPOS = module === "pos";

  const menuItems = isPOS
    ? posMenuItems
    : inventoryMenuItems;

  const systemName = isPOS
    ? "POS System"
    : "Inventory System";

  const footerDescription = isPOS
    ? "Point of Sale"
    : "Inventory Management";

  function handleBackToSystems() {
    onClose();
    navigate("/system");
  }

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
          border-r border-slate-800
          bg-slate-900
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
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-white to-slate-200 text-slate-900 shadow-sm shadow-black/20">
              {isPOS ? (
                <ShoppingCart size={20} />
              ) : (
                <Boxes size={20} />
              )}
            </div>

            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">
                Eclipse
              </h1>

              <p className="text-xs text-slate-400">
                {systemName}
              </p>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
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
                  onClick={onClose}
                  end={
                    item.path === "/" ||
                    item.path === "/pos"
                  }
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

        {/* Back to System Selection */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={handleBackToSystems}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft
              size={18}
              strokeWidth={2}
            />

            <span>Back to Systems</span>
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4">
          <p className="text-xs font-medium text-slate-400">
            Eclipse {systemName}
          </p>

          <p className="mt-1 text-[11px] text-slate-500">
            {footerDescription}
          </p>
        </div>
      </aside>
    </>
  );
}