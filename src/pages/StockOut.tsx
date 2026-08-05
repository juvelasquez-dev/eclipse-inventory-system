import { useState } from "react";

import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import StockTable from "../components/inventory/StockTable";
import TransactionForm from "../components/inventory/TransactionForm";

import { useInventory } from "../hooks/useInventory";

export default function StockOut() {
  const [open, setOpen] = useState(false);

  const {
    transactions,
    products,
    addTransaction,
  } = useInventory();

  const stockOutTransactions = transactions.filter(
    (transaction) => transaction.type === "OUT"
  );

  function handleSubmit(data: {
    productId: string;
    quantity: number;
    remarks: string;
  }) {
    addTransaction({
      id: crypto.randomUUID(),
      productId: data.productId,
      type: "OUT",
      quantity: data.quantity,
      remarks: data.remarks,
      date: new Date().toISOString().split("T")[0],
    });

    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

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

            <Button onClick={() => setOpen(true)}>
              + Release Stock
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6">
          <StockTable
            transactions={stockOutTransactions}
            products={products}
          />
        </div>

        <Modal
          open={open}
          title="Release Stock"
          onClose={() => setOpen(false)}
        >
          <TransactionForm
            type="OUT"
            onSubmit={handleSubmit}
          />
        </Modal>

      </div>
    </div>
  );
}