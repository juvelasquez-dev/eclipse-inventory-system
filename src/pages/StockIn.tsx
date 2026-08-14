import { useState } from "react";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import StockTable from "../components/inventory/StockTable";
import TransactionForm from "../components/inventory/TransactionForm";

import { useInventory } from "../hooks/useInventory";
import { useToast } from "../context/ToastContext";
import { categories } from "../mock/categories";

export default function StockIn() {
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("ALL");

  const {
    transactions,
    products,
    addTransaction,
  } = useInventory();

  const { showToast } = useToast();

  const stockInTransactions = transactions.filter(
    (transaction) => transaction.type === "IN"
  );

  const filteredStockInTransactions =
    stockInTransactions.filter((transaction) => {
      const product = products.find(
        (product) =>
          product.id === transaction.productId
      );

      if (!product) {
        return false;
      }

      const keyword = search
        .toLowerCase()
        .trim();

      const matchesSearch =
        !keyword ||
        product.name
          .toLowerCase()
          .includes(keyword) ||
        product.code
          .toLowerCase()
          .includes(keyword);

      const matchesSize =
        sizeFilter === "ALL" ||
        product.category === sizeFilter;

      return (
        matchesSearch &&
        matchesSize
      );
    });

  function handleSubmit(data: {
    productId: string;
    quantity: number;
    remarks: string;
  }) {
    const product = products.find(
      (product) =>
        product.id === data.productId
    );

    if (!product) {
      showToast("Product not found.");
      return;
    }

    addTransaction({
      id: crypto.randomUUID(),
      productId: data.productId,
      type: "IN",
      quantity: data.quantity,
      remarks: data.remarks,
      date: new Date().toISOString(),
    });

    showToast(
      `${data.quantity} ${product.unit} of ${product.name} added to stock.`
    );

    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-sky-100 to-cyan-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                Incoming
              </span>

              <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Stock In
              </h1>

              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Record incoming inventory.
              </p>
            </div>

            <Button
              onClick={() => setOpen(true)}
            >
              + Add Stock
            </Button>

          </div>
        </div>

        {/* Stock In Content */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">

          {/* Filters */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">

            {/* Search */}
            <div>
              <Input
                label=""
                type="text"
                placeholder="Search flavor or code..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            {/* Size Filter */}
            <div>
              <Select
                label="Size"
                value={sizeFilter}
                onChange={(e) =>
                  setSizeFilter(e.target.value)
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

          {/* Results */}
          {filteredStockInTransactions.length > 0 ? (
            <StockTable
              transactions={
                filteredStockInTransactions
              }
              products={products}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">

              <p className="text-sm font-medium text-slate-600">
                No stock-in records found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try changing your search or filter.
              </p>

            </div>
          )}

        </div>

        {/* Add Stock Modal */}
        <Modal
          open={open}
          title="Add Stock"
          onClose={() => setOpen(false)}
        >
          <TransactionForm
            type="IN"
            onSubmit={handleSubmit}
          />
        </Modal>

      </div>
    </div>
  );
}