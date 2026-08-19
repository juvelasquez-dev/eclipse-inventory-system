import {
  useRef,
  useState,
} from "react";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import StockTable from "../../components/inventory/StockTable";
import TransactionForm from "../../components/inventory/TransactionForm";

import { useInventory } from "../../hooks/useInventory";
import { useToast } from "../../context/ToastContext";
import { categories } from "../../mock/categories";

import {
  readStockExcel,
  validateStockRows,
  type ExcelValidationResult,
} from "../../utils/excel";

export default function StockOut() {
  /*
   * =========================================================
   * MODAL STATE
   * =========================================================
   */

  const [open, setOpen] = useState(false);

  const [importOpen, setImportOpen] =
    useState(false);

  const [importRows, setImportRows] =
    useState<ExcelValidationResult[]>([]);

  const [importFileName, setImportFileName] =
    useState("");

  const [importLoading, setImportLoading] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

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
     * Check against the CURRENT INVENTORY
     * stock, not the transaction history.
     */
    if (
      !hasEnoughStock(
        data.productId,
        data.quantity
      )
    ) {
      const currentStock =
        getProductStock(data.productId);

      showToast(
        `Insufficient stock. Available: ${currentStock}.`
      );

      return;
    }

    addTransaction({
      id: crypto.randomUUID(),
      productId: data.productId,
      type: "OUT",
      quantity: data.quantity,
      remarks: data.remarks,
      date: new Date().toISOString(),
    });

    showToast(
      `${data.quantity} ${
        product.unit
      } of ${product.name} released from stock.`
    );

    setOpen(false);
  }

  /*
   * =========================================================
   * EXCEL IMPORT
   * =========================================================
   */

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  /*
   * Read and validate Excel file.
   *
   * IMPORTANT:
   * getProductStock() now reads from the inventory
   * table, so Stock Out validation uses the real
   * current stock.
   */
  async function handleExcelChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setImportLoading(true);
    setImportFileName(file.name);

    try {
      const rows =
        await readStockExcel(file);

      const validationResults =
        validateStockRows(
          rows,
          products,
          "OUT",
          getProductStock
        );

      setImportRows(
        validationResults
      );

      setImportOpen(true);
    } catch (error) {
      console.error(
        "Excel import error:",
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : "Failed to read Excel file."
      );
    } finally {
      setImportLoading(false);

      /*
       * Allow the same file to be selected
       * again later.
       */
      event.target.value = "";
    }
  }

  /*
   * =========================================================
   * IMPORT RESULTS
   * =========================================================
   */

  const validImportRows =
    importRows.filter(
      (row) => row.valid
    );

  const invalidImportRows =
    importRows.filter(
      (row) => !row.valid
    );

  /*
   * =========================================================
   * CONFIRM EXCEL IMPORT
   * =========================================================
   */

  function handleConfirmImport() {
    /*
     * Never allow a partial import.
     *
     * Every row must be valid.
     */
    if (
      importRows.length === 0 ||
      invalidImportRows.length > 0
    ) {
      return;
    }

    /*
     * Use ONE timestamp for the entire
     * Excel import.
     *
     * This prevents every row from having
     * a slightly different time.
     */
    const importNow = new Date();

    const importTime =
      importNow
        .toTimeString()
        .slice(0, 8);

    for (const row of validImportRows) {
      const product =
        products.find(
          (product) =>
            product.code
              .trim()
              .toLowerCase() ===
            row.productCode
              .trim()
              .toLowerCase()
        );

      /*
       * This should never happen because
       * validation already checks the code.
       */
      if (!product) {
        continue;
      }

      let transactionDate =
        importNow;

      /*
       * If Excel contains a date,
       * preserve that date but use the
       * SAME import time for every row.
       */
      if (row.date) {
        const parsedDate =
          new Date(
            `${row.date}T${importTime}`
          );

        if (
          !Number.isNaN(
            parsedDate.getTime()
          )
        ) {
          transactionDate =
            parsedDate;
        }
      }

      addTransaction({
        id: crypto.randomUUID(),
        productId: product.id,
        type: "OUT",
        quantity: row.quantity,
        date:
          transactionDate.toISOString(),
        remarks:
          row.remarks ??
          "Excel import",
      });
    }

    showToast(
      `${validImportRows.length} stock-out record${
        validImportRows.length === 1
          ? ""
          : "s"
      } imported successfully.`
    );

    handleCancelImport();
  }

  /*
   * =========================================================
   * CANCEL EXCEL IMPORT
   * =========================================================
   */

  function handleCancelImport() {
    setImportRows([]);
    setImportFileName("");
    setImportOpen(false);
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

              {/* Hidden Excel input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={
                  handleExcelChange
                }
              />

              <Button
                onClick={
                  handleImportClick
                }
                disabled={
                  importLoading
                }
              >
                {importLoading
                  ? "Reading..."
                  : "Import Excel"}
              </Button>

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

        {/* =====================================================
            EXCEL IMPORT MODAL
            ===================================================== */}

        <Modal
          open={importOpen}
          title="Import Stock Out"
          onClose={
            handleCancelImport
          }
        >

          <div className="space-y-5">

            {/* File */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

              <p className="text-xs font-medium text-slate-500">
                File
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {importFileName}
              </p>

            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">

                <p className="text-xs text-emerald-700">
                  Valid rows
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  {validImportRows.length}
                </p>

              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">

                <p className="text-xs text-red-700">
                  Invalid rows
                </p>

                <p className="mt-1 text-2xl font-bold text-red-700">
                  {invalidImportRows.length}
                </p>

              </div>

            </div>

            {/* Validation Table */}
            {importRows.length > 0 && (

              <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">

                <table className="w-full text-sm">

                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">

                    <tr>

                      <th className="px-4 py-3 text-left font-semibold text-slate-600">
                        Row
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-slate-600">
                        Product Code
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-slate-600">
                        Quantity
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-slate-600">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-200">

                    {importRows.map(
                      (row) => (

                        <tr
                          key={
                            row.rowNumber
                          }
                        >

                          <td className="px-4 py-3 text-slate-500">
                            {row.rowNumber}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-900">
                            {row.productCode ||
                              "-"}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {row.quantity}
                          </td>

                          <td className="px-4 py-3">

                            {row.valid ? (

                              <div>

                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Valid
                                </span>

                              </div>

                            ) : (

                              <div>

                                <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                  Invalid
                                </span>

                                <div className="mt-2 space-y-1">

                                  {row.errors.map(
                                    (
                                      error,
                                      index
                                    ) => (

                                      <p
                                        key={
                                          index
                                        }
                                        className="text-xs text-red-600"
                                      >
                                        {error}
                                      </p>

                                    )
                                  )}

                                </div>

                              </div>

                            )}

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

            {/* Import blocked */}
            {invalidImportRows.length >
              0 && (

              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">

                <p className="text-sm font-semibold text-red-700">
                  Import blocked
                </p>

                <p className="mt-1 text-xs text-red-600">
                  All rows must be valid
                  before the Stock Out
                  import can be confirmed.
                </p>

              </div>

            )}

            {/* Ready */}
            {invalidImportRows.length ===
              0 &&
              importRows.length > 0 && (

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">

                <p className="text-sm font-semibold text-amber-800">
                  Ready to import
                </p>

                <p className="mt-1 text-xs text-amber-700">
                  {validImportRows.length}{" "}
                  stock-out{" "}
                  {validImportRows.length ===
                  1
                    ? "record"
                    : "records"}{" "}
                  will be released from
                  inventory.
                </p>

              </div>

            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">

              <Button
                onClick={
                  handleCancelImport
                }
              >
                Cancel
              </Button>

              <Button
                onClick={
                  handleConfirmImport
                }
                disabled={
                  importRows.length ===
                    0 ||
                  invalidImportRows.length >
                    0
                }
              >
                Confirm Import
              </Button>

            </div>

          </div>

        </Modal>

      </div>

    </div>
  );
}