import {
  useRef,
  useState,
} from "react";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import StockTable from "../components/inventory/StockTable";
import TransactionForm from "../components/inventory/TransactionForm";

import { useInventory } from "../hooks/useInventory";
import { useToast } from "../context/ToastContext";
import { categories } from "../mock/categories";

import {
  readStockExcel,
  validateStockRows,
  type ExcelValidationResult,
} from "../utils/excel";

export default function StockIn() {
  const [open, setOpen] = useState(false);

  const [importOpen, setImportOpen] =
    useState(false);

  const [importRows, setImportRows] =
    useState<ExcelValidationResult[]>([]);

  const [importLoading, setImportLoading] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] =
    useState("ALL");

  const {
    transactions,
    products,
    addTransaction,
  } = useInventory();

  const { showToast } = useToast();

  const stockInTransactions =
    transactions.filter(
      (transaction) =>
        transaction.type === "IN"
    );

  const filteredStockInTransactions =
    stockInTransactions.filter(
      (transaction) => {
        const product = products.find(
          (product) =>
            product.id ===
            transaction.productId
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
      }
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
      date: new Date().toISOString(),
    });

    showToast(
      `${data.quantity} ${product.unit} of ${product.name} added to stock.`
    );

    setOpen(false);
  }

  async function handleExcelUpload(
    file: File
  ) {
    setImportLoading(true);

    try {
      const rows =
        await readStockExcel(file);

      const validatedRows =
        validateStockRows(
          rows,
          products,
          "IN",
          () => 0
        );

      setImportRows(validatedRows);
      setImportOpen(true);
    } catch (error) {
      console.error(
        "Excel import error:",
        error
      );

      showToast(
        "Unable to read the Excel file."
      );
    } finally {
      setImportLoading(false);
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    void handleExcelUpload(file);

    /*
     * Allow the same file to be selected
     * again later.
     */
    event.target.value = "";
  }

  function closeImportModal() {
    setImportOpen(false);
    setImportRows([]);
  }

  const validRows =
    importRows.filter(
      (row) => row.valid
    );

  const invalidRows =
    importRows.filter(
      (row) => !row.valid
    );

  /*
   * Confirm Excel import.
   *
   * The date comes from Excel.
   * The time comes from the exact moment
   * the user clicks "Confirm Import".
   */
  function confirmImport() {
    if (
      importRows.length === 0 ||
      invalidRows.length > 0
    ) {
      return;
    }

    /*
     * Capture the confirmation time once.
     *
     * Every transaction in this import
     * will use this same timestamp.
     */
    const importTimestamp =
      new Date();

    for (const row of validRows) {
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

      if (!product) {
        continue;
      }

      let transactionDate =
        importTimestamp;

      /*
       * If Excel contains a date,
       * keep that date but use the
       * confirmation time.
       */
      if (row.date) {
        const excelDate =
          new Date(row.date);

        if (
          !Number.isNaN(
            excelDate.getTime()
          )
        ) {
          transactionDate =
            new Date(
              excelDate.getFullYear(),
              excelDate.getMonth(),
              excelDate.getDate(),
              importTimestamp.getHours(),
              importTimestamp.getMinutes(),
              importTimestamp.getSeconds(),
              importTimestamp.getMilliseconds()
            );
        }
      }

      addTransaction({
        id: crypto.randomUUID(),
        productId: product.id,
        type: "IN",
        quantity: row.quantity,
        date:
          transactionDate.toISOString(),
        remarks:
          row.remarks ??
          "Excel import",
      });
    }

    showToast(
      `${validRows.length} stock-in record${
        validRows.length === 1
          ? ""
          : "s"
      } imported successfully.`
    );

    closeImportModal();
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

            <div className="flex flex-col gap-2 sm:flex-row">

              <Button
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                {importLoading
                  ? "Reading..."
                  : "Import Excel"}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />

              <Button
                onClick={() =>
                  setOpen(true)
                }
              >
                + Add Stock
              </Button>

            </div>

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
          onClose={() =>
            setOpen(false)
          }
        >
          <TransactionForm
            type="IN"
            onSubmit={handleSubmit}
          />
        </Modal>

        {/* Excel Import Modal */}
        <Modal
          open={importOpen}
          title="Import Stock In"
          onClose={closeImportModal}
        >

          <div className="space-y-5">

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

              <div className="flex flex-wrap gap-4 text-sm">

                <div>
                  <span className="font-semibold text-slate-900">
                    {importRows.length}
                  </span>{" "}
                  rows
                </div>

                <div className="text-emerald-600">
                  <span className="font-semibold">
                    {validRows.length}
                  </span>{" "}
                  valid
                </div>

                <div className="text-red-600">
                  <span className="font-semibold">
                    {invalidRows.length}
                  </span>{" "}
                  errors
                </div>

              </div>

            </div>

            {importRows.length > 0 ? (
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

                  <tbody className="divide-y divide-slate-100">

                    {importRows.map(
                      (row) => (
                        <tr
                          key={`${row.rowNumber}-${row.productCode}`}
                        >

                          <td className="px-4 py-3 text-slate-500">
                            {row.rowNumber}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-900">
                            {row.productCode ||
                              "—"}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {Number.isFinite(
                              row.quantity
                            )
                              ? row.quantity
                              : "—"}
                          </td>

                          <td className="px-4 py-3">

                            {row.valid ? (
                              <span className="font-medium text-emerald-600">
                                ✓ Valid
                              </span>
                            ) : (
                              <div>
                                <span className="font-medium text-red-600">
                                  ✕ Error
                                </span>

                                <div className="mt-1 text-xs text-red-500">
                                  {row.errors.join(
                                    " "
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
            ) : (
              <p className="text-sm text-slate-500">
                No rows found in the Excel
                file.
              </p>
            )}

            <div className="flex justify-end gap-3">

              <Button
                onClick={
                  closeImportModal
                }
              >
                Cancel
              </Button>

              <Button
                onClick={confirmImport}
                disabled={
                  importRows.length === 0 ||
                  invalidRows.length > 0
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