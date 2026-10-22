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

export default function StockOut() {
  /*
   * =========================================================
   * MODAL STATE
   * =========================================================
   */

  const [open, setOpen] = useState(false);

  /*
   * =========================================================
   * FILTER STATE
   * =========================================================
   */

  const [search, setSearch] =
    useState("");

  const [sizeFilter, setSizeFilter] =
    useState("ALL");

  /*
   * =========================================================
   * INVENTORY
   * =========================================================
   */

  const {
    transactions,
    products,
    addTransaction,
    getProductStock,
    hasEnoughStock,
  } = useInventory();

  const { showToast } = useToast();

  /*
   * =========================================================
   * NORMAL STOCK OUT
   * =========================================================
   */

  async function handleSubmit(data: {
    productId: string;
    quantity: number;
    remarks: string;
  }) {
    if (
      !Number.isSafeInteger(data.quantity) ||
      data.quantity <= 0
    ) {
      showToast(
        "Quantity must be a positive whole number."
      );
      return;
    }

    const product = products.find(
      (product) =>
        product.id === data.productId
    );

    if (!product) {
      showToast("Product not found.");
      return;
    }

    /*
     * Check against the CURRENT INVENTORY
     * stock, not the transaction history.
     */
    const currentStock =
      getProductStock(data.productId);

    if (
      !Number.isSafeInteger(currentStock) ||
      currentStock < 0
    ) {
      showToast(
        "Current stock is unavailable or invalid. Refresh inventory or reconcile stock before continuing."
      );
      return;
    }

    if (
      !hasEnoughStock(
        data.productId,
        data.quantity
      )
    ) {
      showToast(
        `Insufficient stock. Available: ${currentStock}.`
      );

      return;
    }

    const success = await addTransaction({
      id: crypto.randomUUID(),
      productId: data.productId,
      type: "OUT",
      quantity: data.quantity,
      remarks: data.remarks,
      date: new Date().toISOString(),
    });

    if (!success) {
      showToast(
        "Unable to stock out. Please try again."
      );
      return;
    }

    showToast(
      `${data.quantity} ${
        product.unit
      } of ${product.name} released from stock.`
    );

    setOpen(false);
  }

  /*
   * =========================================================
   * STOCK OUT TRANSACTIONS
   * =========================================================
   */

  const stockOutTransactions =
    transactions.filter(
      (transaction) =>
        transaction.type === "OUT"
    );

  /*
   * =========================================================
   * FILTER STOCK OUT TRANSACTIONS
   * =========================================================
   */

  const filteredStockOutTransactions =
    stockOutTransactions.filter(
      (transaction) => {
        const product = products.find(
          (product) =>
            product.id ===
            transaction.productId
        );

        if (!product) {
          return false;
        }

        const keyword =
          search
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
          product.category ===
            sizeFilter;

        return (
          matchesSearch &&
          matchesSize
        );
      }
    );

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        {/* =====================================================
            HEADER
            ===================================================== */}

        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-amber-100 to-rose-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                Outgoing
              </span>

              <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Stock Out
              </h1>

              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Record outgoing inventory.
              </p>

            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <Button
                onClick={() =>
                  setOpen(true)
                }
              >
                + Release Stock
              </Button>

            </div>

          </div>

        </div>

        {/* =====================================================
            STOCK OUT CONTENT
            ===================================================== */}

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
                  setSearch(
                    e.target.value
                  )
                }
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

          {/* Results */}
          {filteredStockOutTransactions.length >
          0 ? (

            <StockTable
              transactions={
                filteredStockOutTransactions
              }
              products={products}
            />

          ) : (

            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">

              <p className="text-sm font-medium text-slate-600">
                No stock-out records found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try changing your search or filter.
              </p>

            </div>

          )}

        </div>

        {/* =====================================================
            MANUAL RELEASE STOCK MODAL
            ===================================================== */}

        <Modal
          open={open}
          title="Release Stock"
          onClose={() =>
            setOpen(false)
          }
        >

          <TransactionForm
            type="OUT"
            onSubmit={
              handleSubmit
            }
          />

        </Modal>

      </div>

    </div>
  );
}