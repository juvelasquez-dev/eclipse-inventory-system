import Card from "../components/ui/Card";
import StockTable from "../components/inventory/StockTable";

import { useInventory } from "../hooks/useInventory";

export default function Dashboard() {
  const {
    totalProducts,
    totalStock,
    stockInToday,
    stockOutToday,
    products,
    transactions,
  } = useInventory();

  const recentTransactions = [...transactions]
    .slice(-5)
    .reverse();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
              Overview
            </span>

            <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Dashboard
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Inventory overview
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

          <Card
            title="Total Products"
            value={totalProducts}
            description="Registered items"
          />

          <Card
            title="Available Stock"
            value={totalStock}
            description="Current inventory"
          />

          <Card
            title="Stock In Today"
            value={stockInToday}
            description="Incoming items"
          />

          <Card
            title="Stock Out Today"
            value={stockOutToday}
            description="Released items"
          />

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Transactions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest inventory activity.
            </p>
          </div>

          <div className="p-6">
            <StockTable
              transactions={recentTransactions}
              products={products}
            />
          </div>

        </div>

      </div>
    </div>
  );
}