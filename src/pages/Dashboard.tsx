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

const ITEMS_PER_PAGE = 5;

export default function Dashboard() {
  const {
    inventory,
    transactions,
    products,
  } = useInventory();

  const [currentPage, setCurrentPage] =
    useState(1);

  /*
   * --------------------------------------------------
   * INVENTORY SUMMARY
   * --------------------------------------------------
   */

  const totalProducts = inventory.length;

  const totalStock = inventory.reduce(
    (total, product) =>
      total + product.stock,
    0
  );

  const lowStockCount = inventory.filter(
    (product) =>
      product.stock > 0 &&
      product.stock <= product.minimumStock
  ).length;

  const outOfStockCount = inventory.filter(
    (product) => product.stock <= 0
  ).length;

  /*
   * --------------------------------------------------
   * STOCK MOVEMENT
   *
   * Based directly on transactions.
   * No mock data is added.
   * --------------------------------------------------
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
      const date = new Date(
        transaction.date
      );

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const dateKey =
        date.toISOString().split("T")[0];

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
        ).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [transactions]);

  /*
   * --------------------------------------------------
   * MOST STOCKED FLAVORS
   *
   * Uses CURRENT inventory stock.
   * --------------------------------------------------
   */

  const mostStockedProducts = useMemo(() => {
    return [...inventory]
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10)
      .map((product) => ({
        name: product.name,
        stock: product.stock,
      }));
  }, [inventory]);

  /*
   * --------------------------------------------------
   * MOST ORDERED FLAVORS
   *
   * "Ordered" is represented by OUT transactions.
   * The quantity is summed per product.
   * --------------------------------------------------
   */

  const mostOrderedProducts = useMemo(() => {
    const ordered: Record<
      string,
      number
    > = {};

    transactions.forEach((transaction) => {
      if (transaction.type !== "OUT") {
        return;
      }

      if (!ordered[transaction.productId]) {
        ordered[transaction.productId] = 0;
      }

      ordered[transaction.productId] +=
        transaction.quantity;
    });

    return Object.entries(ordered)
      .map(
        ([productId, quantity]) => {
          const product =
            products.find(
              (item) =>
                item.id === productId
            );

          if (!product) {
            return null;
          }

          return {
            name: product.name,
            quantity,
          };
        }
      )
      .filter(
        (
          product
        ): product is {
          name: string;
          quantity: number;
        } => product !== null
      )
      .sort(
        (a, b) =>
          b.quantity - a.quantity
      )
      .slice(0, 10);
  }, [transactions, products]);

  /*
   * --------------------------------------------------
   * LOW / OUT OF STOCK PRODUCTS
   * --------------------------------------------------
   */

  const attentionProducts = useMemo(() => {
    return inventory
      .filter(
        (product) =>
          product.stock <=
          product.minimumStock
      )
      .sort((a, b) => {
        if (
          a.stock === 0 &&
          b.stock !== 0
        ) {
          return -1;
        }

        if (
          a.stock !== 0 &&
          b.stock === 0
        ) {
          return 1;
        }

        return a.stock - b.stock;
      });
  }, [inventory]);

  /*
   * --------------------------------------------------
   * RECENT TRANSACTIONS
   * --------------------------------------------------
   */

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  }, [transactions]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedTransactions.length /
        ITEMS_PER_PAGE
    )
  );

  const paginatedTransactions =
    useMemo(() => {
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
   * --------------------------------------------------
   * HELPERS
   * --------------------------------------------------
   */

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

  function formatDateTime(
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
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function getTransactionLabel(
    type: string
  ) {
    if (type === "IN") {
      return "Stock In";
    }

    if (type === "OUT") {
      return "Stock Out";
    }

    return "Adjustment";
  }

  function getTransactionClass(
    type: string
  ) {
    if (type === "IN") {
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    }

    if (type === "OUT") {
      return "bg-rose-50 text-rose-700 ring-rose-200";
    }

    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* ==================================================
            HEADER
        ================================================== */}

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

        {/* ==================================================
            KPI CARDS
        ================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Low Stock
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {lowStockCount}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Products needing attention
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Out of Stock
            </p>

            <p className="mt-2 text-3xl font-bold text-red-600">
              {outOfStockCount}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Products with zero stock
            </p>
          </div>

        </div>

        {/* ==================================================
            STOCK MOVEMENT
        ================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Stock Movement
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Incoming and outgoing
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
            <EmptyChart message="No stock movement yet." />
          )}

        </div>

        {/* ==================================================
            PRODUCT ACTIVITY GRAPHS
        ================================================== */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Most Ordered */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Most Ordered Flavors
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Based on outgoing
                transactions.
              </p>
            </div>

            {mostOrderedProducts.length >
            0 ? (
              <div className="h-[350px] w-full">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={
                      mostOrderedProducts
                    }
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: 10,
                      left: 10,
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
                      width={110}
                      tick={{
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="quantity"
                      name="Ordered"
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
              <EmptyChart message="No outgoing transactions yet." />
            )}

          </div>

          {/* Most Stocked */}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Current Stock by Flavor
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Products with the highest
                current stock.
              </p>
            </div>

            {mostStockedProducts.length >
            0 ? (
              <div className="h-[350px] w-full">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={
                      mostStockedProducts
                    }
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: 10,
                      left: 10,
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
                      width={110}
                      tick={{
                        fontSize: 11,
                      }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="stock"
                      name="Current Stock"
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
              <EmptyChart message="No inventory available." />
            )}

          </div>

        </div>

        {/* ==================================================
            INVENTORY ATTENTION
        ================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Inventory Attention
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Products that are low or
              completely out of stock.
            </p>
          </div>

          {attentionProducts.length >
          0 ? (
            <div className="overflow-x-auto">

              <table className="w-full border-collapse">

                <thead className="border-b border-slate-200 bg-slate-50/80">

                  <tr>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Current Stock
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Minimum
                    </th>

                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {attentionProducts
                    .slice(0, 10)
                    .map((product) => {

                      const out =
                        product.stock <=
                        0;

                      return (
                        <tr
                          key={
                            product.id
                          }
                          className="hover:bg-slate-50"
                        >

                          <td className="px-6 py-4">

                            <p className="font-medium text-slate-900">
                              {
                                product.name
                              }
                            </p>

                            <p className="text-sm text-slate-500">
                              {
                                product.code
                              }
                            </p>

                          </td>

                          <td className="px-6 py-4 text-center font-semibold tabular-nums text-slate-900">
                            {
                              product.stock
                            }
                          </td>

                          <td className="px-6 py-4 text-center tabular-nums text-slate-500">
                            {
                              product.minimumStock
                            }
                          </td>

                          <td className="px-6 py-4 text-center">

                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                                out
                                  ? "bg-red-50 text-red-700 ring-red-200"
                                  : "bg-amber-50 text-amber-700 ring-amber-200"
                              }`}
                            >
                              {out
                                ? "Out of Stock"
                                : "Low Stock"}
                            </span>

                          </td>

                        </tr>
                      );
                    })}

                </tbody>

              </table>

            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">

              <p className="text-sm font-medium text-slate-600">
                Inventory looks good.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                No products currently need
                attention.
              </p>

            </div>
          )}

        </div>

        {/* ==================================================
            RECENT TRANSACTIONS
        ================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Transactions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest inventory activity.
            </p>
          </div>

          {sortedTransactions.length >
          0 ? (
            <>

              <div className="overflow-x-auto">

                <table className="w-full border-collapse">

                  <thead className="border-b border-slate-200 bg-slate-50/80">

                    <tr>

                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date & Time
                      </th>

                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Type
                      </th>

                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Product
                      </th>

                      <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quantity
                      </th>

                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Remarks
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {paginatedTransactions.map(
                      (transaction) => {

                        const isOut =
                          transaction.type ===
                          "OUT";

                        const isAdjustment =
                          transaction.type ===
                          "ADJUSTMENT";

                        const negative =
                          isOut ||
                          (isAdjustment &&
                            transaction.quantity <
                              0);

                        return (
                          <tr
                            key={
                              transaction.id
                            }
                            className="hover:bg-slate-50"
                          >

                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                              {formatDateTime(
                                transaction.date
                              )}
                            </td>

                            <td className="px-6 py-4 text-center">

                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getTransactionClass(
                                  transaction.type
                                )}`}
                              >
                                {getTransactionLabel(
                                  transaction.type
                                )}
                              </span>

                            </td>

                            <td className="px-6 py-4 font-medium text-slate-900">
                              {getProductName(
                                transaction.productId
                              )}
                            </td>

                            <td
                              className={`px-6 py-4 text-center font-semibold tabular-nums ${
                                negative
                                  ? "text-rose-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {negative
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

                  </tbody>

                </table>

              </div>

              {/* Pagination */}

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-2 pt-4 sm:flex-row sm:items-center sm:justify-between">

                <p className="text-sm text-slate-500">

                  Showing{" "}

                  <span className="font-medium text-slate-700">
                    {startItem}
                  </span>

                  {" "}to{" "}

                  <span className="font-medium text-slate-700">
                    {endItem}
                  </span>

                  {" "}of{" "}

                  <span className="font-medium text-slate-700">
                    {
                      sortedTransactions.length
                    }
                  </span>

                  {" "}transactions

                </p>

                <div className="flex items-center gap-1">

                  <button
                    type="button"
                    onClick={
                      goToPreviousPage
                    }
                    disabled={
                      currentPage === 1
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {Array.from(
                    {
                      length: totalPages,
                    },
                    (_, index) =>
                      index + 1
                  ).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() =>
                        setCurrentPage(
                          page
                        )
                      }
                      className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        currentPage ===
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
                    onClick={
                      goToNextPage
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>

                </div>

              </div>

            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">

              <p className="text-sm font-medium text-slate-600">
                No transactions yet.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Inventory activity will appear
                here once transactions are
                recorded.
              </p>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

/*
 * Empty chart state
 */

function EmptyChart({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex h-[350px] items-center justify-center rounded-xl border border-dashed border-slate-300">
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600">
          {message}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Data will appear here once
          inventory activity is recorded.
        </p>
      </div>
    </div>
  );
}