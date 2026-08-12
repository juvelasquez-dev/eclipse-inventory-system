import { useState } from "react";

import { useInventory } from "../hooks/useInventory";

import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

export default function History() {
  const {
    transactions,
    products,
  } = useInventory();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const keyword = search.toLowerCase().trim();

  const filteredTransactions = transactions
  .filter((transaction) => {
    const product = products.find(
      (product) =>
        product.id === transaction.productId
    );

    const productName =
      product?.name.toLowerCase() ?? "";

    const date =
      transaction.date.toLowerCase();

    const quantity =
      String(transaction.quantity);

    return (
      productName.includes(keyword) ||
      date.includes(keyword) ||
      quantity.includes(keyword)
    );
  })
  .filter((transaction) => {
    if (filter === "IN") {
      return transaction.type === "IN";
    }

    if (filter === "OUT") {
      return transaction.type === "OUT";
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              Activity Log
            </span>

            <h1 className="mt-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              History
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              View all stock movements and inventory transactions.
            </p>
          </div>
        </div>

        {/* History Card */}
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row">

            <div className="flex-1">
              <Input
                placeholder="Search flavor, size, date, or quantity..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <div className="w-full md:w-64">
              <Select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value)
                }
                options={[
                  {
                    label: "All Transactions",
                    value: "ALL",
                  },
                  {
                    label: "Stock In",
                    value: "IN",
                  },
                  {
                    label: "Stock Out",
                    value: "OUT",
                  },
                ]}
              />
            </div>

          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </th>

                    <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </th>

                    <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Quantity
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Remarks
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredTransactions.map(
                    (transaction) => {
                      const product =
                        products.find(
                          (product) =>
                            product.id ===
                            transaction.productId
                        );

                      const isStockIn =
                        transaction.type === "IN";

                      return (
                        <tr
                          key={transaction.id}
                          className="transition-colors hover:bg-slate-50"
                        >

                          {/* Date */}
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                            {transaction.date}
                          </td>

                          {/* Product */}
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {product?.name ??
                                "Unknown Product"}
                            </div>

                            {product?.code && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {product.code}
                              </div>
                            )}
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                                isStockIn
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : "bg-rose-50 text-rose-700 ring-rose-200"
                              }`}
                            >
                              {isStockIn
                                ? "Stock In"
                                : "Stock Out"}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td
                            className={`px-6 py-4 text-center font-semibold tabular-nums ${
                              isStockIn
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {isStockIn
                              ? "+"
                              : "−"}
                            {transaction.quantity}{" "}
                            {product?.unit ?? ""}
                          </td>

                          {/* Remarks */}
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {transaction.remarks ||
                              "-"}
                          </td>

                        </tr>
                      );
                    }
                  )}

                  {/* Empty State */}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center"
                      >
                        <div className="text-sm font-medium text-slate-600">
                          No transactions found.
                        </div>

                        <div className="mt-1 text-sm text-slate-400">
                          Try changing your search or filter.
                        </div>
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}