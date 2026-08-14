import { useEffect, useMemo, useState } from "react";

import type {
  Product,
  Transaction,
} from "../../types/inventory";

interface StockTableProps {
  transactions: Transaction[];
  products: Product[];
  showType?: boolean;
}

const ITEMS_PER_PAGE = 10;

export default function StockTable({
  transactions,
  products,
  showType = false,
}: StockTableProps) {
  const [currentPage, setCurrentPage] =
    useState(1);

  function getProductName(
    productId: string
  ) {
    return (
      products.find(
        (product) =>
          product.id === productId
      )?.name ?? "Unknown Product"
    );
  }

  /*
   * Sort by the exact transaction timestamp.
   *
   * Newest transaction appears first.
   */
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      return (
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
      );
    });
  }, [transactions]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedTransactions.length /
        ITEMS_PER_PAGE
    )
  );

  /*
   * Reset pagination whenever the filtered
   * transaction list changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedTransactions = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    return sortedTransactions.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [
    sortedTransactions,
    currentPage,
  ]);

  const startItem =
    sortedTransactions.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const endItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    sortedTransactions.length
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

  /*
   * Format transaction date/time.
   *
   * New transactions contain a full ISO
   * timestamp. Older mock transactions may
   * only contain YYYY-MM-DD, which is also
   * handled safely.
   */
  function formatDateTime(date: string) {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  }

  function getTypeLabel(
    transaction: Transaction
  ) {
    if (transaction.type === "IN") {
      return "Stock In";
    }

    if (transaction.type === "OUT") {
      return "Stock Out";
    }

    return transaction.quantity >= 0
      ? "Adjustment +"
      : "Adjustment −";
  }

  function getTypeClasses(
    transaction: Transaction
  ) {
    if (transaction.type === "IN") {
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    }

    if (transaction.type === "OUT") {
      return "bg-rose-50 text-rose-700 ring-rose-200";
    }

    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  function getQuantityClasses(
    transaction: Transaction
  ) {
    if (transaction.type === "IN") {
      return "text-emerald-600";
    }

    if (transaction.type === "OUT") {
      return "text-rose-600";
    }

    return transaction.quantity >= 0
      ? "text-violet-600"
      : "text-orange-600";
  }

  function getQuantityPrefix(
    transaction: Transaction
  ) {
    if (transaction.type === "OUT") {
      return "-";
    }

    if (
      transaction.type === "ADJUSTMENT" &&
      transaction.quantity < 0
    ) {
      return "-";
    }

    return "+";
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">

          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>

              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date & Time
              </th>

              {showType && (
                <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
              )}

              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product
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

            {paginatedTransactions.map(
              (transaction) => (
                <tr
                  key={transaction.id}
                  className="transition-colors hover:bg-slate-50"
                >

                  {/* Date & Time */}
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                    {formatDateTime(
                      transaction.date
                    )}
                  </td>

                  {/* Type */}
                  {showType && (
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getTypeClasses(
                          transaction
                        )}`}
                      >
                        {getTypeLabel(
                          transaction
                        )}
                      </span>
                    </td>
                  )}

                  {/* Product */}
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {getProductName(
                      transaction.productId
                    )}
                  </td>

                  {/* Quantity */}
                  <td
                    className={`px-6 py-4 text-center font-semibold tabular-nums ${getQuantityClasses(
                      transaction
                    )}`}
                  >
                    {getQuantityPrefix(
                      transaction
                    )}
                    {Math.abs(
                      transaction.quantity
                    )}
                  </td>

                  {/* Remarks */}
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {transaction.remarks ||
                      "-"}
                  </td>

                </tr>
              )
            )}

            {sortedTransactions.length === 0 && (
              <tr>
                <td
                  colSpan={showType ? 5 : 4}
                  className="px-6 py-12 text-center text-sm text-slate-500"
                >
                  No transactions found.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      {/* Pagination */}
{sortedTransactions.length > 0 && (
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
        {sortedTransactions.length}
      </span>{" "}
      transactions
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