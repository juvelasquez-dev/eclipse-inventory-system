import { useState } from "react";

import InventoryTable from "../components/inventory/InventoryTable";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";

import { categories } from "../mock/categories";
import { useInventory } from "../hooks/useInventory";
import { exportInventoryToExcel } from "../utils/excel";
import { useToast } from "../context/ToastContext";

export default function Inventory() {
  const {
    inventory,
    products,
    transactions,
  } = useInventory();

  const { showToast } = useToast();

  const [search, setSearch] =
    useState("");

  const [sizeFilter, setSizeFilter] =
    useState("ALL");

  const [stockFilter, setStockFilter] =
    useState("ALL");

  const [quantitySort, setQuantitySort] =
    useState("NONE");

  /*
   * Filter and sort inventory
   */
  const filteredInventory =
    inventory
      .filter((product) => {
        const keyword =
          search.toLowerCase().trim();

        if (!keyword) {
          return true;
        }

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
        if (sizeFilter === "ALL") {
          return true;
        }

        return (
          product.category ===
          sizeFilter
        );
      })

      .filter((product) => {
        switch (stockFilter) {
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
      })

      /*
       * Quantity sorting
       */
      .sort((a, b) => {
        if (quantitySort === "ASC") {
          return a.stock - b.stock;
        }

        if (quantitySort === "DESC") {
          return b.stock - a.stock;
        }

        return 0;
      });

  /*
   * Size summary
   *
   * Calculated from the selected size
   * before search and stock filters.
   */
  const sizeInventory =
    sizeFilter === "ALL"
      ? inventory
      : inventory.filter(
          (product) =>
            product.category ===
            sizeFilter
        );

  const totalProducts =
    sizeInventory.length;

  const totalStock =
    sizeInventory.reduce(
      (total, product) =>
        total + product.stock,
      0
    );

  const lowStockCount =
    sizeInventory.filter(
      (product) =>
        product.stock > 0 &&
        product.stock <=
          product.minimumStock
    ).length;

  const outOfStockCount =
    sizeInventory.filter(
      (product) =>
        product.stock === 0
    ).length;

  const selectedUnit =
    sizeInventory[0]?.unit ?? "";

  /*
   * Export inventory
   */
  function handleExportExcel() {
    try {
      exportInventoryToExcel(
        products,
        inventory,
        transactions
      );

      showToast(
        "Inventory exported successfully."
      );
    } catch (error) {
      console.error(
        "Inventory export failed:",
        error
      );

      showToast(
        "Failed to export inventory."
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

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

            <Button
              onClick={
                handleExportExcel
              }
            >
              Export Excel
            </Button>

          </div>
        </div>

        {/* Inventory Content */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">

          {/* Filters */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">

            {/* Search */}
            <div>
              <Input
                label=""
                type="text"
                placeholder="Search flavor or code..."
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />
            </div>

            {/* Size Filter */}
            <div>
              <Select
                label="Size"
                value={sizeFilter}
                onChange={(e) =>
                  setSizeFilter(
                    e.target.value
                  )
                }
                options={[
                  {
                    label: "All Sizes",
                    value: "ALL",
                  },
                  ...categories.map(
                    (category) => ({
                      label: category,
                      value: category,
                    })
                  ),
                ]}
              />
            </div>

            {/* Stock Filter */}
            <div>
              <Select
                label="Stock Status"
                value={stockFilter}
                onChange={(e) =>
                  setStockFilter(
                    e.target.value
                  )
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

            {/* Quantity Sort */}
            <div>
              <Select
                label="Quantity"
                value={quantitySort}
                onChange={(e) =>
                  setQuantitySort(
                    e.target.value
                  )
                }
                options={[
                  {
                    label: "Default",
                    value: "NONE",
                  },
                  {
                    label: "Lowest First",
                    value: "ASC",
                  },
                  {
                    label: "Highest First",
                    value: "DESC",
                  },
                ]}
              />
            </div>

          </div>

          {/* Size Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              {/* Selected Size */}
              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {sizeFilter === "ALL"
                    ? "All Sizes"
                    : sizeFilter}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Inventory summary
                </p>

              </div>

              {/* Summary Values */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">

                {/* Products */}
                <div>

                  <p className="text-xs text-slate-500">
                    Products
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {totalProducts}
                  </p>

                </div>

                {/* Total Stock */}
                <div>

                  <p className="text-xs text-slate-500">
                    Total Stock
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {totalStock}

                    {selectedUnit && (
                      <span className="ml-1 text-sm font-medium text-slate-500">
                        {selectedUnit}
                      </span>
                    )}

                  </p>

                </div>

                {/* Low Stock */}
                <div>

                  <p className="text-xs text-slate-500">
                    Low Stock
                  </p>

                  <p className="mt-1 text-xl font-bold text-amber-600">
                    {lowStockCount}
                  </p>

                </div>

                {/* Out of Stock */}
                <div>

                  <p className="text-xs text-slate-500">
                    Out of Stock
                  </p>

                  <p className="mt-1 text-xl font-bold text-red-600">
                    {outOfStockCount}
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* Results */}
          {filteredInventory.length > 0 ? (

            <InventoryTable
              products={
                filteredInventory
              }
            />

          ) : (

            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">

              <p className="text-sm font-medium text-slate-600">
                No inventory found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try changing your search or filters.
              </p>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}