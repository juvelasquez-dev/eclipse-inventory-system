import { Menu } from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({
  onMenuClick,
}: TopbarProps) {
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

      <div className="shrink-0 text-sm text-slate-500">
        Admin
      </div>
    </header>
  );
}