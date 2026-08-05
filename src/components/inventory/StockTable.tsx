import type {
  Product,
  Transaction,
} from "../../types/inventory";

interface StockTableProps {
  transactions: Transaction[];
  products: Product[];
  showType?: boolean;
}

export default function StockTable({
  transactions,
  products,
  showType = false,
}: StockTableProps) {
  function getProductName(productId: string) {
    return (
      products.find(
        (product) => product.id === productId
      )?.name ?? "Unknown Product"
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date
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
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="transition-colors hover:bg-slate-50"
              >
                <td className="px-6 py-4 text-sm text-slate-500">
                  {transaction.date}
                </td>

                {showType && (
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        transaction.type === "IN"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                      }`}
                    >
                      {transaction.type === "IN"
                        ? "Stock In"
                        : "Stock Out"}
                    </span>
                  </td>
                )}

                <td className="px-6 py-4 font-medium text-slate-900">
                  {getProductName(transaction.productId)}
                </td>

                <td
                  className={`px-6 py-4 text-center font-semibold tabular-nums ${
                    transaction.type === "IN"
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {transaction.type === "IN" ? "+" : "-"}
                  {transaction.quantity}
                </td>

                <td className="px-6 py-4 text-sm text-slate-500">
                  {transaction.remarks || "-"}
                </td>
              </tr>
            ))}

            {transactions.length === 0 && (
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
    </div>
  );
}