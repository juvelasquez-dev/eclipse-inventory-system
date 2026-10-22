import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import SalesSummaryReport from "./SalesSummaryReport";
import { useToast } from "../../context/ToastContext";
import {
  downloadPOSTransactionReport,
  loadPOSTransactionReport,
  validateReportDateRange,
} from "../../utils/posTransactionReport";

export default function POSReports() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  function openModal() {
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (isExporting) return;
    setModalOpen(false);
  }

  async function handleExport() {
    const validationError = validateReportDateRange(startDate, endDate);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsExporting(true);
    try {
      const receipts = await loadPOSTransactionReport(startDate, endDate);
      if (receipts.length === 0) {
        setError("No completed POS transactions were found for this date range.");
        return;
      }
      downloadPOSTransactionReport(receipts, startDate, endDate);
      showToast(`Exported ${receipts.length} POS transaction(s).`);
      setModalOpen(false);
    } catch (exportError) {
      console.error("Unable to export POS transaction report:", exportError);
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export the POS transaction report."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Sales
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
              Reports
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Export saved POS data to Excel.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  POS Transaction Report
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Completed POS transactions and their items for a date range.
                  Cancelled transactions are excluded.
                </p>
              </div>
            </div>

            <Button type="button" onClick={openModal}>
              Export Excel
            </Button>
          </div>
        </section>

        <SalesSummaryReport />
      </div>

      <Modal
        open={modalOpen}
        title="Export POS Transaction Report"
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="report-start-date"
              label="Start date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              disabled={isExporting}
              required
            />
            <Input
              id="report-end-date"
              label="End date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={isExporting}
              required
            />
          </div>

          <p className="text-xs text-slate-500">
            The full end date is included (Asia/Manila time).
          </p>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export Excel"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
