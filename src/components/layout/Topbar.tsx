export default function Topbar() {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <h2 className="font-semibold text-slate-700">
        Inventory Management
      </h2>

      <div className="text-sm text-slate-500">
        Admin
      </div>
    </header>
  );
}