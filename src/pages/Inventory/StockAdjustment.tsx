import { useState } from "react";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import StockTable from "../../components/inventory/StockTable";
import TransactionForm from "../../components/inventory/TransactionForm";

import { useInventory } from "../../hooks/useInventory";
import { useToast } from "../../context/ToastContext";
import { categories } from "../../mock/categories";

export default function StockAdjustment() {
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("ALL");

  const {
    transactions,
    products,
    addTransaction,
  } = useInventory();

  const { showToast } = useToast();

  /*
   * Get all adjustment transactions.
   */
  const adjustmentTransactions =
    transactions
      .filter(
        (transaction) =>
          transaction.type === "ADJUSTMENT"
      )
      .filter((transaction) => {
        const product = products.find(
          (product) =>
            product.id === transaction.productId
        );

        if (!product) {
          return false;
        }

        const keyword =
          search.toLowerCase().trim();

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

    /*
     * ADJUSTMENT quantity is already
     * positive for ADD and negative
     * for REMOVE because TransactionForm
     * handles that conversion.
     */
    addTransaction({
      id: crypto.randomUUID(),
      productId: data.productId,
      type: "ADJUSTMENT",
      quantity: data.quantity,
      remarks:
        data.remarks ||
        "Inventory adjustment",

      /*
       * Store the exact time the adjustment
       * happened so transactions can be
       * correctly ordered.
       */
      date: new Date().toISOString(),
    });

    const action =
      data.quantity >= 0
        ? "added to"
        : "removed from";

    showToast(
      `${Math.abs(data.quantity)} ${
        product.unit
      } of ${product.name} ${action} inventory.`
    );

    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                Inventory Correction
              </span>

              <h1 className="mt-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                Stock Adjustment
              </h1>

              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Correct inventory quantities when
                physical stock differs from the
                recorded stock.
              </p>

            </div>

            <Button
              onClick={() => setOpen(true)}
            >
              + Adjust Stock
            </Button>

          </div>
        </div>

        {/* Adjustment History */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          {/* Filters */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2">

            {/* Search */}
            <Input
              label=""
              type="text"
              placeholder="Search flavor or code..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

            {/* Size */}
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

          {/* Results */}
          <StockTable
            transactions={
              adjustmentTransactions
            }
            products={products}
            showType
          />

        </div>

        {/* Adjustment Modal */}
        <Modal
          open={open}
          title="Adjust Stock"
          onClose={() => setOpen(false)}
        >
          <TransactionForm
            type="ADJUSTMENT"
            onSubmit={handleSubmit}
          />
        </Modal>

      </div>
    </div>
  );
}