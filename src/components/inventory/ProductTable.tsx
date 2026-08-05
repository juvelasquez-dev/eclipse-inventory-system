import Button from "../ui/Button";

import type { Product } from "../../types/inventory";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export default function ProductTable({
  products,
  onEdit,
  onDelete,
}: ProductTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Code
              </th>

              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product
              </th>

              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </th>

              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unit
              </th>

              <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Minimum Stock
              </th>

              <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {products.map((product) => (
              <tr
                key={product.id}
                className="transition-colors hover:bg-slate-50"
              >
                <td className="px-6 py-4 text-sm text-slate-500">
                  {product.code}
                </td>

                <td className="px-6 py-4 font-medium text-slate-900">
                  {product.name}
                </td>

                <td className="px-6 py-4 text-sm text-slate-600">
                  {product.category}
                </td>

                <td className="px-6 py-4 text-sm text-slate-600">
                  {product.unit}
                </td>

                <td className="px-6 py-4 text-center tabular-nums text-slate-900">
                  {product.minimumStock}
                </td>

                <td className="px-6 py-4">
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onEdit(product)}
                    >
                      Edit
                    </Button>

                    <Button
                      variant="danger"
                      onClick={() => onDelete(product)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {products.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-slate-500"
                >
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}