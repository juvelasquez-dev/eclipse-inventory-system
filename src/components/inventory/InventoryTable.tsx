import { useEffect, useMemo, useState } from "react";

import type { Product } from "../../types/inventory";

interface InventoryTableProps {
  products: (Product & {
    stock: number;
  })[];
}

const ITEMS_PER_PAGE = 10;

export default function InventoryTable({
  products,
}: InventoryTableProps) {
  const [currentPage, setCurrentPage] =
    useState(1);

  function getStatus(
    stock: number,
    minimumStock: number
  ) {
    if (stock <= 0) {
      return {
        label: "Out of Stock",
        className:
          "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      };
    }

    if (stock <= minimumStock) {
      return {
        label: "Low Stock",
        className:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      };
    }

    return {
      label: "In Stock",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    };
  }

  /*
   * Calculate pagination.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(
      products.length / ITEMS_PER_PAGE
    )
  );

  /*
   * Reset to page 1 whenever the filtered
   * inventory changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [products]);

  /*
   * Prevent the current page from exceeding
   * the available number of pages.
   */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /*
   * Get only the products for the current page.
   */
  const paginatedProducts = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    return products.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [products, currentPage]);

  const startItem =
    products.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const endItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    products.length
  );

  function goToPreviousPage() {
    setCurrentPage((page) =>
      Math.max(1, page - 1)
    );
  }

  function goToNextPage() {
    setCurrentPage((page) =>
      Math.min(totalPages, page + 1)
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">

          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>

              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product
              </th>

              <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current Stock
              </th>

              <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Minimum Stock
              </th>

              <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>

            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">

            {paginatedProducts.map(
              (product) => {
                const status = getStatus(
                  product.stock,
                  product.minimumStock
                );

                return (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-slate-50"
                  >

                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {product.name}
                      </div>

                      <div className="text-sm text-slate-500">
                        {product.code}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-900">
                      {product.stock}
                    </td>

                    <td className="px-6 py-4 text-center tabular-nums text-slate-500">
                      {product.minimumStock}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>

                  </tr>
                );
              }
            )}

            {products.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-sm text-slate-500"
                >
                  No inventory available.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {/* Pagination */}
{products.length > 0 && (
  <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

    <p className="text-sm text-slate-500">
      Showing{" "}
      <span className="font-medium text-slate-700">
        {startItem}
      </span>{" "}
      to{" "}
      <span className="font-medium text-slate-700">
        {endItem}
      </span>{" "}
      of{" "}
      <span className="font-medium text-slate-700">
        {products.length}
      </span>{" "}
      products
    </p>

    <div className="flex items-center gap-1">

      {/* Previous */}
      <button
        type="button"
        onClick={goToPreviousPage}
        disabled={currentPage === 1}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>

      {/* Page Numbers */}
      {Array.from(
        { length: totalPages },
        (_, index) => index + 1
      ).map((page) => (
        <button
          key={page}
          type="button"
          onClick={() =>
            setCurrentPage(page)
          }
          className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            currentPage === page
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {page}
        </button>
      ))}

      {/* Next */}
      <button
        type="button"
        onClick={goToNextPage}
        disabled={
          currentPage === totalPages
        }
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>

    </div>
  </div>
)}

    </div>
  );
}