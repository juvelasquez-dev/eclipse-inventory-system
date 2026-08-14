import { useEffect, useMemo, useState } from "react";

import { useInventory } from "../hooks/useInventory";

import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

import { categories } from "../mock/categories";

export default function History() {
  const {
    transactions,
    products,
  } = useInventory();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [sizeFilter, setSizeFilter] =
    useState("ALL");

  const [currentPage, setCurrentPage] =
    useState(1);

  const ITEMS_PER_PAGE = 10;

  const keyword =
    search.toLowerCase().trim();

  /*
   * Filter and sort transactions.
   *
   * Order is based on the exact timestamp
   * when the transaction happened.
   *
   * Newest transactions appear first.
   */
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => {
        const product =
          products.find(
            (product) =>
              product.id ===
              transaction.productId
          );

        const productName =
          product?.name.toLowerCase() ?? "";

        const productCode =
          product?.code.toLowerCase() ?? "";

        const date =
          transaction.date.toLowerCase();

        const quantity = String(
          Math.abs(transaction.quantity)
        );

        const remarks =
          transaction.remarks
            ?.toLowerCase() ?? "";

        const matchesSearch =
          !keyword ||
          productName.includes(keyword) ||
          productCode.includes(keyword) ||
          date.includes(keyword) ||
          quantity.includes(keyword) ||
          remarks.includes(keyword);

        const matchesType =
          filter === "ALL" ||
          transaction.type === filter;

        const matchesSize =
          sizeFilter === "ALL" ||
          product?.category === sizeFilter;

        return (
          matchesSearch &&
          matchesType &&
          matchesSize
        );
      })
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      );
  }, [
    transactions,
    products,
    keyword,
    filter,
    sizeFilter,
  ]);

  /*
   * Pagination
   */
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredTransactions.length /
        ITEMS_PER_PAGE
    )
  );

  /*
   * Reset to page 1 whenever the search
   * or filters change.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    filter,
    sizeFilter,
  ]);

  /*
   * Prevent page from exceeding the
   * available pages.
   */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /*
   * Transactions shown on the current page.
   */
  const paginatedTransactions =
    useMemo(() => {
      const startIndex =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

      return filteredTransactions.slice(
        startIndex,
        startIndex + ITEMS_PER_PAGE
      );
    }, [
      filteredTransactions,
      currentPage,
    ]);

  const startItem =
    filteredTransactions.length === 0
      ? 0
      : (currentPage - 1) *
          ITEMS_PER_PAGE +
        1;

  const endItem = Math.min(
    currentPage * ITEMS_PER_PAGE,
    filteredTransactions.length
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

  function getTypeLabel(
    transaction: (typeof transactions)[number]
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
    transaction: (typeof transactions)[number]
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
    transaction: (typeof transactions)[number]
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
    transaction: (typeof transactions)[number]
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
              View all stock movements and
              inventory transactions.
            </p>

          </div>
        </div>

        {/* History Card */}
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          {/* Filters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            {/* Search */}
            <div>
              <Input
                placeholder="Search flavor, code, date, quantity, or remarks..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            {/* Transaction Type */}
            <div>
              <Select
                label="Transaction Type"
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value)
                }
                options={[
                  {
                    label:
                      "All Transactions",
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
                  {
                    label: "Adjustments",
                    value: "ADJUSTMENT",
                  },
                ]}
              />
            </div>

            {/* Size */}
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

          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200">

            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead className="border-b border-slate-200 bg-slate-50/80">

                  <tr>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date & Time
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

                  {paginatedTransactions.map(
                    (transaction) => {
                      const product =
                        products.find(
                          (product) =>
                            product.id ===
                            transaction.productId
                        );

                      return (
                        <tr
                          key={
                            transaction.id
                          }
                          className="transition-colors hover:bg-slate-50"
                        >

                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                            {formatDateTime(
                              transaction.date
                            )}
                          </td>

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
                            )}{" "}
                            {product?.unit ??
                              ""}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-500">
                            {transaction.remarks ||
                              "-"}
                          </td>

                        </tr>
                      );
                    }
                  )}

                  {filteredTransactions.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center"
                      >
                        <div className="text-sm font-medium text-slate-600">
                          No transactions
                          found.
                        </div>

                        <div className="mt-1 text-sm text-slate-400">
                          Try changing your
                          search or filters.
                        </div>
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* Pagination */}
            {filteredTransactions.length > 0 && (
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
                    {filteredTransactions.length}
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
                  {(() => {
                    const pages: (
                      | number
                      | "ellipsis-left"
                      | "ellipsis-right"
                    )[] = [];

                    if (totalPages <= 7) {
                      for (
                        let page = 1;
                        page <= totalPages;
                        page++
                      ) {
                        pages.push(page);
                      }
                    } else {
                      pages.push(1);

                      if (currentPage > 4) {
                        pages.push("ellipsis-left");
                      }

                      const startPage = Math.max(
                        2,
                        currentPage - 1
                      );

                      const endPage = Math.min(
                        totalPages - 1,
                        currentPage + 1
                      );

                      for (
                        let page = startPage;
                        page <= endPage;
                        page++
                      ) {
                        pages.push(page);
                      }

                      if (currentPage < totalPages - 3) {
                        pages.push("ellipsis-right");
                      }

                      pages.push(totalPages);
                    }

                    return pages.map((page) => {
                      if (
                        page === "ellipsis-left" ||
                        page === "ellipsis-right"
                      ) {
                        return (
                          <span
                            key={page}
                            className="px-2 text-sm text-slate-400"
                          >
                            ...
                          </span>
                        );
                      }

                      return (
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
                      );
                    });
                  })()}

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
      </div>
    </div>
  );
}