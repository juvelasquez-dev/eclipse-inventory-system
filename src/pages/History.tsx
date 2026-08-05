import StockTable from "../components/inventory/StockTable";
import { useInventory } from "../hooks/useInventory";

export default function History() {
  const { transactions, products } = useInventory();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              Records
            </span>

            <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Transaction History
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              View all stock movement records.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6">
          <StockTable
            transactions={transactions}
            products={products}
            showType
          />
        </div>

      </div>
    </div>
  );
}