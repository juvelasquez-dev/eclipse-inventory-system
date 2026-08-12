import { useState } from "react";

import InventoryTable from "../components/inventory/InventoryTable";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

import { useInventory } from "../hooks/useInventory";

export default function Inventory() {
  const { inventory } = useInventory();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const filteredInventory =
    inventory
      .filter((product) => {
        const keyword = search.toLowerCase();

        return (
          product.name
            .toLowerCase()
            .includes(keyword) ||
          product.code
            .toLowerCase()
            .includes(keyword)
        );
      })
      .filter((product) => {
        switch (filter) {
          case "AVAILABLE":
            return (
              product.stock >
              product.minimumStock
            );

          case "LOW":
            return (
              product.stock > 0 &&
              product.stock <=
                product.minimumStock
            );

          case "OUT":
            return product.stock === 0;

          default:
            return true;
        }
      });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative">

            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Stock Levels
            </span>

            <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Inventory
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Monitor current inventory levels.
            </p>

          </div>

        </div>


        {/* Inventory Content */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">

          <div className="flex flex-col gap-4 md:flex-row">

            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search inventory..."
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
                    label: "In Stock",
                    value: "AVAILABLE",
                  },
                  {
                    label: "Low Stock",
                    value: "LOW",
                  },
                  {
                    label: "Out of Stock",
                    value: "OUT",
                  },
                ]}
              />

            </div>

          </div>


          {filteredInventory.length > 0 ? (
            <InventoryTable
              products={filteredInventory}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">

              <p className="text-sm font-medium text-slate-600">
                No inventory found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try changing your search or filter.
              </p>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}