import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import DeliveryReceiptPrint, {
  type ReceiptData,
} from "../../components/pos/DeliveryReceiptPrint";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";

interface POSHistoryRow extends ReceiptData {
  id: string;
  transactionStatus: string;
}

function mapHistoryRow(
  row: any,
  itemRows: any[]
): POSHistoryRow {
  const items = itemRows.map(
    (item: any) => ({
      product: {
        id: item.product_id,
        code: item.product_code_snapshot,
        name: item.product_name_snapshot,
        category: "",
        unit: item.unit_snapshot,
        price: Number(item.unit_price),
        minimumStock: 0,
      },
      quantity: Number(item.quantity),
    })
  );

  return {
    id: row.id,
    deliveryReceiptNumber:
      `DR-${String(row.delivery_receipt_sequence).padStart(4, "0")}`,
    customerName: row.customer_name ?? "",
    customerAddress: row.customer_address ?? "",
    customerPhone: row.customer_phone ?? "",
    amountReceived: Number(row.amount_received),
    paymentMethod: row.payment_method ?? "",
    createdAt: row.created_at,
    items,
    subtotal: Number(row.subtotal),
    changeAmount: Number(row.change_amount),
    transactionStatus: row.transaction_status ?? "",
  };
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/*
 * =========================================================
 * DATE FILTER HELPERS
 * =========================================================
 */

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function matchesDateFilter(
  createdAt: string,
  dateFilter: string,
  customStart: string,
  customEnd: string
) {
  if (dateFilter === "ALL") {
    return true;
  }

  const txDate = new Date(createdAt);
  const now = new Date();

  if (dateFilter === "TODAY") {
    const start = startOfDay(now);
    const end = addDays(start, 1);
    return txDate >= start && txDate < end;
  }

  if (dateFilter === "YESTERDAY") {
    const start = addDays(startOfDay(now), -1);
    const end = startOfDay(now);
    return txDate >= start && txDate < end;
  }

  if (dateFilter === "THIS_WEEK") {
    return txDate >= startOfWeek(now);
  }

  if (dateFilter === "THIS_MONTH") {
    return txDate >= startOfMonth(now);
  }

  if (dateFilter === "CUSTOM") {
    if (!customStart && !customEnd) {
      return true;
    }

    if (customStart) {
      const start = startOfDay(new Date(customStart));
      if (txDate < start) return false;
    }

    if (customEnd) {
      const end = addDays(startOfDay(new Date(customEnd)), 1);
      if (txDate >= end) return false;
    }

    return true;
  }

  return true;
}

/*
 * =========================================================
 * ITEM SUMMARY HELPERS
 * =========================================================
 */

function getItemsSummary(items: POSHistoryRow["items"]) {
  if (items.length === 0) return "No items";
  if (items.length === 1) return items[0].product.name;
  return `${items[0].product.name} + ${items.length - 1} more`;
}

function getTotalQuantity(items: POSHistoryRow["items"]) {
  return items.reduce(
    (total, item) => total + item.quantity,
    0
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function POSHistory() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [transactions, setTransactions] =
    useState<POSHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] =
    useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedTransaction, setSelectedTransaction] =
    useState<POSHistoryRow | null>(null);
  const [receipt, setReceipt] =
    useState<ReceiptData | null>(null);
  const [printRequested, setPrintRequested] =
    useState(false);

  /*
   * =========================================================
   * FILTER / SORT / PAGINATION STATE (UI-only, client-side)
   * =========================================================
   */

  const [dateFilter, setDateFilter] =
    useState("ALL");
  const [customStart, setCustomStart] =
    useState("");
  const [customEnd, setCustomEnd] =
    useState("");
  const [paymentFilter, setPaymentFilter] =
    useState("ALL");
  const [sortBy, setSortBy] =
    useState("NEWEST");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!receipt || !printRequested) {
      return;
    }

    const printTimer = window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 0);

    return () => window.clearTimeout(printTimer);
  }, [receipt, printRequested]);

  useEffect(() => {
    async function loadTransactions() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoading(false);
        navigate("/login", {
          replace: true,
        });
        return;
      }

      const { data, error } = await supabase
        .from("pos_transactions")
        .select(
          "id, delivery_receipt_sequence, customer_name, customer_address, customer_phone, subtotal, amount_received, change_amount, payment_method, transaction_status, created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        setLoadError(error.message);
        showToast(
          error.message ||
            "Unable to load POS transaction history.",
          "error"
        );
        setLoading(false);
        return;
      }

      const transactionIds = (data ?? []).map(
        (row) => row.id
      );

      let itemRows: any[] = [];

      if (transactionIds.length > 0) {
        const {
          data: loadedItems,
          error: itemError,
        } = await supabase
          .from("pos_transaction_items")
          .select(
            "transaction_id, product_id, product_name_snapshot, product_code_snapshot, unit_snapshot, unit_price, quantity, line_amount"
          )
          .in("transaction_id", transactionIds);

        if (itemError) {
          setLoadError(itemError.message);
          showToast(
            itemError.message ||
              "Unable to load POS transaction items.",
            "error"
          );
          setLoading(false);
          return;
        }

        itemRows = loadedItems ?? [];
      }

      setTransactions(
        (data ?? []).map((row) =>
          mapHistoryRow(
            row,
            itemRows.filter(
              (item) =>
                item.transaction_id === row.id
            )
          )
        )
      );
      setLoading(false);
    }

    void loadTransactions();
  }, [navigate, showToast]);

  /*
   * =========================================================
   * FILTERING
   * =========================================================
   */

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !keyword ||
        transaction.deliveryReceiptNumber
          .toLowerCase()
          .includes(keyword) ||
        transaction.customerName
          .toLowerCase()
          .includes(keyword) ||
        transaction.customerPhone
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "ALL" ||
        transaction.transactionStatus === status;

      const matchesPayment =
        paymentFilter === "ALL" ||
        transaction.paymentMethod === paymentFilter;

      const matchesDate = matchesDateFilter(
        transaction.createdAt,
        dateFilter,
        customStart,
        customEnd
      );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesDate
      );
    });
  }, [
    transactions,
    search,
    status,
    paymentFilter,
    dateFilter,
    customStart,
    customEnd,
  ]);

  const hasFilters =
    search.trim() !== "" ||
    status !== "ALL" ||
    paymentFilter !== "ALL" ||
    dateFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setPaymentFilter("ALL");
    setDateFilter("ALL");
    setCustomStart("");
    setCustomEnd("");
  }

  /*
   * =========================================================
   * SORTING
   * =========================================================
   */

  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];

    switch (sortBy) {
      case "OLDEST":
        return list.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

      case "AMOUNT_HIGH":
        return list.sort(
          (a, b) => b.subtotal - a.subtotal
        );

      case "AMOUNT_LOW":
        return list.sort(
          (a, b) => a.subtotal - b.subtotal
        );

      case "QTY_HIGH":
        return list.sort(
          (a, b) =>
            getTotalQuantity(b.items) -
            getTotalQuantity(a.items)
        );

      case "QTY_LOW":
        return list.sort(
          (a, b) =>
            getTotalQuantity(a.items) -
            getTotalQuantity(b.items)
        );

      case "NEWEST":
      default:
        return list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );
    }
  }, [filteredTransactions, sortBy]);

  /*
   * =========================================================
   * SUMMARY CARDS (based on the filtered set)
   * =========================================================
   */

  const summary = useMemo(() => {
    const totalTransactions = filteredTransactions.length;

    const totalSales = filteredTransactions.reduce(
      (total, transaction) => total + transaction.subtotal,
      0
    );

    const totalItemsSold = filteredTransactions.reduce(
      (total, transaction) =>
        total + getTotalQuantity(transaction.items),
      0
    );

    const averageValue =
      totalTransactions > 0
        ? totalSales / totalTransactions
        : 0;

    return {
      totalTransactions,
      totalSales,
      totalItemsSold,
      averageValue,
    };
  }, [filteredTransactions]);

  /*
   * =========================================================
   * PAGINATION
   * =========================================================
   */

  const totalPages = Math.max(
    1,
    Math.ceil(sortedTransactions.length / pageSize)
  );

  const paginatedTransactions = sortedTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    status,
    paymentFilter,
    dateFilter,
    customStart,
    customEnd,
    sortBy,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        Math.abs(i - page) <= 1
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }

    return pages;
  }, [totalPages, page]);

  function openDetails(transaction: POSHistoryRow) {
    setSelectedTransaction(transaction);
  }

  function closeDetails() {
    setSelectedTransaction(null);
    setReceipt(null);
  }

  function printTransaction(transaction: POSHistoryRow) {
    setReceipt(transaction);
    setPrintRequested(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Sales
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
              Transaction History
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              View and manage completed POS transactions.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Transactions
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {summary.totalTransactions}
              </h3>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Sales
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-emerald-700">
                {formatPrice(summary.totalSales)}
              </h3>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Items Sold
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {summary.totalItemsSold}
              </h3>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Average Transaction Value
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {formatPrice(summary.averageValue)}
              </h3>
            )}
          </div>

        </div>

        {/* Filters + Table */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          {/* Filter Toolbar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">

            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">

              <Input
                label="Search"
                type="text"
                placeholder="DR number, customer, or phone..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <Select
                label="Date"
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value)
                }
                options={[
                  { label: "All Dates", value: "ALL" },
                  { label: "Today", value: "TODAY" },
                  { label: "Yesterday", value: "YESTERDAY" },
                  { label: "This Week", value: "THIS_WEEK" },
                  { label: "This Month", value: "THIS_MONTH" },
                  { label: "Custom Date Range", value: "CUSTOM" },
                ]}
              />

              <Select
                label="Payment Method"
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(event.target.value)
                }
                options={[
                  { label: "All Payment Methods", value: "ALL" },
                  { label: "Cash", value: "CASH" },
                ]}
              />

              <Select
                label="Status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Completed", value: "COMPLETED" },
                ]}
              />

            </div>

            {dateFilter === "CUSTOM" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={customStart}
                  onChange={(event) =>
                    setCustomStart(event.target.value)
                  }
                />
                <Input
                  label="End Date"
                  type="date"
                  value={customEnd}
                  onChange={(event) =>
                    setCustomEnd(event.target.value)
                  }
                />
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

              <div className="w-full sm:max-w-xs">
                <Select
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value)
                  }
                  options={[
                    { label: "Newest First", value: "NEWEST" },
                    { label: "Oldest First", value: "OLDEST" },
                    { label: "Highest Amount", value: "AMOUNT_HIGH" },
                    { label: "Lowest Amount", value: "AMOUNT_LOW" },
                    { label: "Highest Quantity", value: "QTY_HIGH" },
                    { label: "Lowest Quantity", value: "QTY_LOW" },
                  ]}
                />
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
                >
                  Clear Filters
                </button>
              )}

            </div>

          </div>

          {/* Table / States */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-dashed border-red-200 bg-red-50 py-12 text-center">
              <p className="text-sm font-medium text-red-700">
                Unable to load transaction history.
              </p>
              <p className="mt-1 text-xs text-red-500">
                {loadError}
              </p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
              <p className="text-sm font-medium text-slate-600">
                No transactions yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Completed sales will appear here.
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
              <p className="text-sm font-medium text-slate-600">
                No transactions match your filters.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try adjusting your search or filters.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[880px] border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">DR Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date &amp; Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Items</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Total Items</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 font-semibold text-emerald-700">
                          {transaction.deliveryReceiptNumber}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {new Date(transaction.createdAt).toLocaleString("en-PH")}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-900">
                          {transaction.customerName || "Walk-in Customer"}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">
                          {getItemsSummary(transaction.items)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm tabular-nums text-slate-600">
                          {getTotalQuantity(transaction.items)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatPrice(transaction.subtotal)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {transaction.paymentMethod}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            {transaction.transactionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => openDetails(transaction)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-sm text-slate-500">
                    Showing{" "}
                    {sortedTransactions.length === 0
                      ? 0
                      : (page - 1) * pageSize + 1}
                    –
                    {Math.min(page * pageSize, sortedTransactions.length)}{" "}
                    of {sortedTransactions.length} transactions
                  </p>

                  <div className="w-full max-w-[9rem]">
                    <Select
                      label=""
                      value={String(pageSize)}
                      onChange={(event) =>
                        setPageSize(Number(event.target.value))
                      }
                      options={PAGE_SIZE_OPTIONS.map((size) => ({
                        label: `${size} / page`,
                        value: String(size),
                      }))}
                    />
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {pageNumbers.map((entry, index) =>
                      entry === "..." ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-2 text-sm text-slate-400"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={entry}
                          type="button"
                          onClick={() => setPage(entry)}
                          className={
                            entry === page
                              ? "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                              : "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          }
                        >
                          {entry}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      <Modal
        open={selectedTransaction !== null}
        title={selectedTransaction?.deliveryReceiptNumber ?? "Transaction Details"}
        onClose={closeDetails}
      >
        {selectedTransaction && (
          <div className="space-y-5">

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <span className="text-slate-500">Delivery Receipt</span>
                <span className="text-right font-semibold text-emerald-700">{selectedTransaction.deliveryReceiptNumber}</span>

                <span className="text-slate-500">Date &amp; Time</span>
                <span className="text-right text-slate-900">{new Date(selectedTransaction.createdAt).toLocaleString("en-PH")}</span>

                <span className="text-slate-500">Customer</span>
                <span className="text-right text-slate-900">{selectedTransaction.customerName || "Walk-in Customer"}</span>

                <span className="text-slate-500">Address</span>
                <span className="text-right text-slate-900">{selectedTransaction.customerAddress || "-"}</span>

                <span className="text-slate-500">Phone</span>
                <span className="text-right text-slate-900">{selectedTransaction.customerPhone || "-"}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Code</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedTransaction.items.map((item) => (
                    <tr key={item.product.id}>
                      <td className="px-3 py-3 font-medium text-slate-900">{item.product.name}</td>
                      <td className="px-3 py-3 text-slate-500">{item.product.code}</td>
                      <td className="px-3 py-3 text-slate-500">{item.product.unit}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatPrice(item.product.price)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatPrice(item.product.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>{formatPrice(selectedTransaction.subtotal)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount Received</span><strong>{formatPrice(selectedTransaction.amountReceived)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Change</span><strong className="text-emerald-700">{formatPrice(selectedTransaction.changeAmount)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Method</span><strong>{selectedTransaction.paymentMethod}</strong></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">Status</span><strong>{selectedTransaction.transactionStatus}</strong></div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDetails}
              >
                Close
              </Button>

              <Button
                type="button"
                onClick={() => printTransaction(selectedTransaction)}
              >
                Reprint Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <DeliveryReceiptPrint receipt={receipt} />
    </div>
  );
}