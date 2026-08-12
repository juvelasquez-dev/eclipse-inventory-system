import { useState } from "react";

import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import StockTable from "../components/inventory/StockTable";
import TransactionForm from "../components/inventory/TransactionForm";

import { useInventory } from "../hooks/useInventory";
import { useToast } from "../context/ToastContext";

export default function StockIn() {
  const [open, setOpen] = useState(false);

  const {
    transactions,
    products,
    addTransaction,
  } = useInventory();

  const { showToast } = useToast();

  const stockInTransactions = transactions.filter(
    (transaction) => transaction.type === "IN"
  );

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
      date: new Date()
        .toISOString()
        .split("T")[0],
    });

    showToast(
      `${data.quantity} ${product.unit} of ${product.name} added to stock.`
    );

    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

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


        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6">

          <StockTable
            transactions={stockInTransactions}
            products={products}
          />

        </div>


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