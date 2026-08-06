import { useState } from "react";

import StockTable from "../components/inventory/StockTable";

import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

import { useInventory } from "../hooks/useInventory";

export default function History() {
  const {
    transactions,
    products,
  } = useInventory();

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState("ALL");

  const filteredTransactions =
    transactions.filter((transaction) => {
      const keyword =
        search.toLowerCase();

      const product =
        products.find(
          (product) =>
            product.id ===
            transaction.productId
        );

      const matchesSearch =
        product?.name
          .toLowerCase()
          .includes(keyword) ||
        product?.code
          .toLowerCase()
          .includes(keyword) ||
        transaction.remarks
          ?.toLowerCase()
          .includes(keyword);

      const matchesFilter =
        filter === "ALL" ||
        transaction.type === filter;

      return (
        matchesSearch &&
        matchesFilter
      );
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              Activity
            </span>

            <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Transaction History
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              View every inventory movement.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">

          <div className="flex flex-col gap-4 md:flex-row">

            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search transactions..."
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
                    label: "All",
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

          <StockTable
            transactions={filteredTransactions}
            products={products}
          />

        </div>

      </div>
    </div>
  );
}