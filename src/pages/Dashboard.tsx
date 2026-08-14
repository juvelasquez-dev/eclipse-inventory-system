import { useMemo, useState } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { useInventory } from "../hooks/useInventory";

const TRANSACTIONS_PER_PAGE = 5;

export default function Dashboard() {
  const {
    products,
    inventory,
    transactions,
    totalProducts,
    totalStock,
    stockInToday,
    stockOutToday,
    getLowStockProducts,
    getOutOfStockProducts,
  } = useInventory();

  const [transactionPage, setTransactionPage] =
    useState(1);

  /*
   * Current low-stock products
   */
  const lowStockProducts =
    getLowStockProducts();

  /*
   * Current out-of-stock products
   */
  const outOfStockProducts =
    getOutOfStockProducts();

  /*
   * ----------------------------------------
   * STOCK MOVEMENT
   * ----------------------------------------
   *
   * Uses actual transactions.
   *
   * IN          = stock received
   * OUT         = stock released
   * ADJUSTMENT  = excluded from movement
   */
  const stockMovement = useMemo(() => {
    const movement: Record<
      string,
      {
        date: string;
        stockIn: number;
        stockOut: number;
      }
    > = {};

    transactions.forEach((transaction) => {
      if (
        transaction.type !== "IN" &&
        transaction.type !== "OUT"
      ) {
        return;
      }

      const parsedDate = new Date(
        transaction.date
      );

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        return;
      }

      const dateKey =
        parsedDate.toISOString().split("T")[0];

      if (!movement[dateKey]) {
        movement[dateKey] = {
          date: dateKey,
          stockIn: 0,
          stockOut: 0,
        };
      }

      if (transaction.type === "IN") {
        movement[dateKey].stockIn +=
          transaction.quantity;
      }

      if (transaction.type === "OUT") {
        movement[dateKey].stockOut +=
          transaction.quantity;
      }
    });

    return Object.values(movement)
      .sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      .map((item) => ({
        ...item,
        label: new Date(
          `${item.date}T00:00:00`
        ).toLocaleDateString(
          "en-PH",
          {
            month: "short",
            day: "numeric",
          }
        ),
      }));
  }, [transactions]);

  /*
   * ----------------------------------------
   * STOCK IN BY FLAVOR
   * ----------------------------------------
   *
   * Counts how much of each product has
   * actually been stocked in.
   */
  const stockInByProduct = useMemo(() => {
    const totals: Record<
      string,
      number
    > = {};

    transactions
      .filter(
        (transaction) =>
          transaction.type === "IN"
      )
      .forEach((transaction) => {
        totals[transaction.productId] =
          (totals[transaction.productId] ??
            0) +
          transaction.quantity;
      });

    return products
      .map((product) => ({
        name: product.name,
        quantity:
          totals[product.id] ?? 0,
      }))
      .filter(
        (product) =>
          product.quantity > 0
      )
      .sort(
        (a, b) =>
          b.quantity - a.quantity
      )
      .slice(0, 10);
  }, [transactions, products]);

  /*
   * ----------------------------------------
   * STOCK OUT BY FLAVOR
   * ----------------------------------------
   *
   * Counts how much of each product has
   * actually been released.
   */
  const stockOutByProduct = useMemo(() => {
    const totals: Record<
      string,
      number
    > = {};

    transactions
      .filter(
        (transaction) =>
          transaction.type === "OUT"
      )
      .forEach((transaction) => {
        totals[transaction.productId] =
          (totals[transaction.productId] ??
            0) +
          transaction.quantity;
      });

    return products
      .map((product) => ({
        name: product.name,
        quantity:
          totals[product.id] ?? 0,
      }))
      .filter(
        (product) =>
          product.quantity > 0
      )
      .sort(
        (a, b) =>
          b.quantity - a.quantity
      )
      .slice(0, 10);
  }, [transactions, products]);

  /*
   * ----------------------------------------
   * CURRENT INVENTORY BY FLAVOR
   * ----------------------------------------
   *
   * Uses current calculated inventory.
   */
  const inventoryByProduct = useMemo(() => {
    return inventory
      .map((product) => ({
        name: product.name,
        stock: product.stock,
      }))
      .sort(
        (a, b) =>
          b.stock - a.stock
      )
      .slice(0, 10);
  }, [inventory]);

  /*
   * ----------------------------------------
   * RECENT TRANSACTIONS
   * ----------------------------------------
   */
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      );
  }, [transactions]);

  const totalTransactionPages =
    Math.max(
      1,
      Math.ceil(
        recentTransactions.length /
          TRANSACTIONS_PER_PAGE
      )
    );

  const paginatedTransactions =
    recentTransactions.slice(
      (transactionPage - 1) *
        TRANSACTIONS_PER_PAGE,
      transactionPage *
        TRANSACTIONS_PER_PAGE
    );

  const transactionStart =
    recentTransactions.length === 0
      ? 0
      : (transactionPage - 1) *
          TRANSACTIONS_PER_PAGE +
        1;

  const transactionEnd = Math.min(
    transactionPage *
      TRANSACTIONS_PER_PAGE,
    recentTransactions.length
  );

  function getProductName(
    productId: string
  ) {
    return (
      products.find(
        (product) =>
          product.id === productId
      )?.name ??
      "Unknown Product"
    );
  }

  function formatDate(
    date: string
  ) {
    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return date;
    }

    return parsedDate.toLocaleString(
      "en-PH",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function getTransactionType(
    type: string
  ) {
    if (type === "IN") {
      return {
        label: "Stock In",
        className:
          "bg-emerald-50 text-emerald-700 ring-emerald-200",
      };
    }

    if (type === "OUT") {
      return {
        label: "Stock Out",
        className:
          "bg-rose-50 text-rose-700 ring-rose-200",
      };
    }

    return {
      label: "Adjustment",
      className:
        "bg-violet-50 text-violet-700 ring-violet-200",
    };
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* ========================================
            HEADER
        ======================================== */}

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 opacity-60 blur-2xl" />

          <div className="relative">

            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              Overview
            </span>

            <h1 className="mt-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
              Dashboard
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Monitor inventory levels,
              stock movement, and product
              activity.
            </p>

          </div>
        </div>

        {/* ========================================
            KPI CARDS
        ======================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <p className="text-sm font-medium text-slate-500">
              Total Products
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalProducts}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Products being tracked
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <p className="text-sm font-medium text-slate-500">
              Total Stock
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalStock}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Current available inventory
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Stock In Today
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {stockInToday}
            </p>

            <p className="mt-1 text-xs text-emerald-600/70">
              Received today
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
            <p className="text-sm font-medium text-rose-700">
              Stock Out Today
            </p>

            <p className="mt-2 text-3xl font-bold text-rose-700">
              {stockOutToday}
            </p>

            <p className="mt-1 text-xs text-rose-600/70">
              Released today
            </p>
          </div>

        </div>

        {/* ========================================
            INVENTORY ALERTS
        ======================================== */}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="font-semibold text-slate-900">
                  Low Stock
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Products that need attention
                </p>
              </div>

              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {lowStockProducts.length}
              </span>

            </div>

            <div className="mt-4 space-y-3">

              {lowStockProducts.length === 0 ? (
                <p className="py-4 text-sm text-slate-400">
                  No low-stock products.
                </p>
              ) : (
                lowStockProducts
                  .slice(0, 5)
                  .map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {product.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          Minimum:{" "}
                          {product.minimumStock}
                        </p>
                      </div>

                      <span className="font-semibold text-amber-600">
                        {product.stock}
                      </span>
                    </div>
                  ))
              )}

            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="font-semibold text-slate-900">
                  Out of Stock
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Products currently unavailable
                </p>
              </div>

              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {outOfStockProducts.length}
              </span>

            </div>

            <div className="mt-4 space-y-3">

              {outOfStockProducts.length === 0 ? (
                <p className="py-4 text-sm text-slate-400">
                  No products are out of stock.
                </p>
              ) : (
                outOfStockProducts
                  .slice(0, 5)
                  .map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {product.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {product.code}
                        </p>
                      </div>

                      <span className="font-semibold text-red-600">
                        0
                      </span>
                    </div>
                  ))
              )}

            </div>
          </div>

        </div>

        {/* ========================================
            STOCK MOVEMENT
        ======================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-6">

            <h2 className="text-lg font-semibold text-slate-900">
              Stock Movement
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Actual incoming and outgoing
              inventory activity.
            </p>

          </div>

          {stockMovement.length > 0 ? (
            <div className="h-[350px] w-full">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={stockMovement}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="stockIn"
                    name="Stock In"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="stockOut"
                    name="Stock Out"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />

                </LineChart>
              </ResponsiveContainer>

            </div>
          ) : (
            <div className="flex h-[350px] items-center justify-center rounded-xl border border-dashed border-slate-300">
              <p className="text-sm text-slate-400">
                No stock movement yet.
              </p>
            </div>
          )}

        </div>

        {/* ========================================
            PRODUCT MOVEMENT GRAPHS
        ======================================== */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Stock In */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="mb-6">

              <h2 className="text-lg font-semibold text-slate-900">
                Most Stocked-In Flavors
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Products with the highest
                recorded incoming stock.
              </p>

            </div>

            {stockInByProduct.length > 0 ? (
              <div className="h-[350px]">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={stockInByProduct}
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: 20,
                      left: 20,
                      bottom: 0,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />

                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="quantity"
                      name="Stock In"
                      fill="#10b981"
                      radius={[
                        0,
                        6,
                        6,
                        0,
                      ]}
                    />

                  </BarChart>
                </ResponsiveContainer>

              </div>
            ) : (
              <div className="flex h-[350px] items-center justify-center rounded-xl border border-dashed border-slate-300">
                <p className="text-sm text-slate-400">
                  No stock-in transactions yet.
                </p>
              </div>
            )}

          </div>

          {/* Stock Out */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="mb-6">

              <h2 className="text-lg font-semibold text-slate-900">
                Most Stocked-Out Flavors
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Products with the highest
                recorded outgoing stock.
              </p>

            </div>

            {stockOutByProduct.length > 0 ? (
              <div className="h-[350px]">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={stockOutByProduct}
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: 20,
                      left: 20,
                      bottom: 0,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />

                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="quantity"
                      name="Stock Out"
                      fill="#f43f5e"
                      radius={[
                        0,
                        6,
                        6,
                        0,
                      ]}
                    />

                  </BarChart>
                </ResponsiveContainer>

              </div>
            ) : (
              <div className="flex h-[350px] items-center justify-center rounded-xl border border-dashed border-slate-300">
                <p className="text-sm text-slate-400">
                  No stock-out transactions yet.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* ========================================
            CURRENT INVENTORY BY FLAVOR
        ======================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-6">

            <h2 className="text-lg font-semibold text-slate-900">
              Current Inventory by Flavor
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current available stock across
              your products.
            </p>

          </div>

          {inventoryByProduct.length > 0 ? (
            <div className="h-[350px]">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={inventoryByProduct}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 50,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    tick={{
                      fontSize: 11,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="stock"
                    name="Current Stock"
                    fill="#6366f1"
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  />

                </BarChart>
              </ResponsiveContainer>

            </div>
          ) : (
            <div className="flex h-[350px] items-center justify-center rounded-xl border border-dashed border-slate-300">
              <p className="text-sm text-slate-400">
                No inventory available.
              </p>
            </div>
          )}

        </div>

        {/* ========================================
            RECENT TRANSACTIONS
        ======================================== */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">

            <h2 className="text-lg font-semibold text-slate-900">
              Recent Transactions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest inventory activity.
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full border-collapse">

              <thead className="border-b border-slate-200 bg-slate-50/80">

                <tr>

                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>

                  <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Type
                  </th>

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
                  (transaction) => {
                    const type =
                      getTransactionType(
                        transaction.type
                      );

                    const isNegative =
                      transaction.type ===
                        "OUT" ||
                      (transaction.type ===
                        "ADJUSTMENT" &&
                        transaction.quantity <
                          0);

                    return (
                      <tr
                        key={transaction.id}
                        className="transition-colors hover:bg-slate-50"
                      >

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                          {formatDate(
                            transaction.date
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">

                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${type.className}`}
                          >
                            {type.label}
                          </span>

                        </td>

                        <td className="px-6 py-4 font-medium text-slate-900">
                          {getProductName(
                            transaction.productId
                          )}
                        </td>

                        <td
                          className={`px-6 py-4 text-center font-semibold tabular-nums ${
                            isNegative
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {isNegative
                            ? "-"
                            : "+"}
                          {Math.abs(
                            transaction.quantity
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {transaction.remarks ||
                            "-"}
                        </td>

                      </tr>
                    );
                  }
                )}

                {recentTransactions.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      No transactions yet.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

          {/* Transaction Pagination */}
          {recentTransactions.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {transactionStart}
                </span>{" "}
                to{" "}
                <span className="font-medium text-slate-700">
                  {transactionEnd}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {
                    recentTransactions.length
                  }
                </span>{" "}
                transactions
              </p>

              <div className="flex items-center gap-1">

                <button
                  type="button"
                  onClick={() =>
                    setTransactionPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  disabled={
                    transactionPage === 1
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from(
                  {
                    length:
                      totalTransactionPages,
                  },
                  (_, index) =>
                    index + 1
                ).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() =>
                      setTransactionPage(
                        page
                      )
                    }
                    className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      transactionPage ===
                      page
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setTransactionPage(
                      (page) =>
                        Math.min(
                          totalTransactionPages,
                          page + 1
                        )
                    )
                  }
                  disabled={
                    transactionPage ===
                    totalTransactionPages
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