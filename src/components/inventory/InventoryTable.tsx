import type { Product } from "../../types/inventory";

interface InventoryTableProps {
  products: (Product & {
    stock: number;
  })[];
}

export default function InventoryTable({
  products,
}: InventoryTableProps) {
  function getStatus(
    stock: number,
    minimumStock: number
  ) {
    if (stock <= 0) {
      return {
        label: "Out of Stock",
        className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      };
    }

    if (stock <= minimumStock) {
      return {
        label: "Low Stock",
        className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      };
    }

    return {
      label: "In Stock",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    };
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
            {products.map((product) => {
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
            })}

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
    </div>
  );
}