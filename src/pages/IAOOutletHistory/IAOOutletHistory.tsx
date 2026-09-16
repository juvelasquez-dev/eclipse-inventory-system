import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import IAOOutletOrderReceiptPrint, {
  type IAOOutletOrderReceipt,
} from "../../components/iao/IAOOutletOrderReceiptPrint";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";

type OrderType = "ALL" | "MANUAL" | "POS_COPY";

interface HistoryRow {
  orderId: string;
  orderType: Exclude<OrderType, "ALL">;
  receiptDisplay: string;
  outletName: string;
  grandTotal: number;
  createdAt: string;
}

function formatPrice(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function IAOOutletHistory() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<OrderType>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [viewingOrder, setViewingOrder] = useState<IAOOutletOrderReceipt | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [receiptToPrint, setReceiptToPrint] = useState<IAOOutletOrderReceipt | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadHistory() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("list_iao_outlet_orders", {
          p_search: search.trim(),
          p_type: typeFilter,
          p_page: currentPage,
          p_page_size: pageSize,
        });
        if (error) throw error;
        if (isCancelled) return;

        const nextRows: HistoryRow[] = (data ?? [])
          .filter((row: any) => row.order_id !== null)
          .map((row: any) => ({
            orderId: row.order_id,
            orderType: row.order_type,
            receiptDisplay: row.receipt_display,
            outletName: row.outlet_name,
            grandTotal: Number(row.grand_total),
            createdAt: row.created_at,
          }));

        setRows(nextRows);
        setTotalCount((data ?? []).length > 0 ? Number(data[0].total_count) : 0);
      } catch (error) {
        if (isCancelled) return;
        console.error("Unable to load IAO order history:", error);
        showToast(error instanceof Error ? error.message : "Unable to load IAO order history.", "error");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    void loadHistory();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, totalCount);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  async function fetchOrderDetails(orderId: string) {
    const { data, error } = await supabase.rpc("get_iao_outlet_order_details", {
      p_order_id: orderId,
    });
    if (error) throw error;
    return data as IAOOutletOrderReceipt;
  }

  async function handleView(orderId: string) {
    setIsDetailLoading(true);
    try {
      const details = await fetchOrderDetails(orderId);
      setViewingOrder(details);
    } catch (error) {
      console.error("Unable to load IAO order details:", error);
      showToast(error instanceof Error ? error.message : "Unable to load order details.", "error");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function printOrder(receipt: IAOOutletOrderReceipt) {
    setReceiptToPrint(receipt);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button type="button" onClick={() => navigate("/iao-outlet-orders")} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-cyan-700">
                <ArrowLeft size={16} /> Back to Outlet Orders
              </button>
              <span className="mt-5 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-200">IAO Distribution</span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Transaction History</h1>
              <p className="mt-2 text-sm text-slate-500">View and reprint previous IAO outlet orders, including copies from Eclipse POS.</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Outlet name or receipt (e.g. EFT-0002)" />
            </div>
            <div className="w-full sm:w-48">
              <Select
                label="Type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as OrderType)}
                options={[
                  { value: "ALL", label: "All" },
                  { value: "MANUAL", label: "Manual" },
                  { value: "POS_COPY", label: "POS Copy" },
                ]}
              />
            </div>
            <div className="w-full sm:w-36">
              <Select
                label="Per page"
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value))}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Receipt</th>
                  <th className="pb-3">Outlet</th>
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-500">Loading history...</td></tr>
                )}
                {!isLoading && rows.map((row) => (
                  <tr key={row.orderId}>
                    <td className="py-3 text-slate-600">{new Date(row.createdAt).toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" })}</td>
                    <td className="py-3 font-semibold text-slate-900">{row.receiptDisplay}</td>
                    <td className="py-3 text-slate-700">{row.outletName}</td>
                    <td className="py-3 text-right font-medium text-slate-900">{formatPrice(row.grandTotal)}</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${row.orderType === "POS_COPY" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-cyan-50 text-cyan-700 ring-cyan-200"}`}>
                        {row.orderType === "POS_COPY" ? "POS Copy" : "Manual"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button type="button" onClick={() => handleView(row.orderId)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50">
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-500">No IAO outlet orders found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {totalCount === 0 ? "No records" : `Showing ${showingStart}-${showingEnd} of ${totalCount}`}
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-medium ${page === currentPage ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal open={Boolean(viewingOrder) || isDetailLoading} title="Order details" onClose={() => setViewingOrder(null)}>
        {isDetailLoading && <p className="py-6 text-center text-sm text-slate-500">Loading order details...</p>}
        {!isDetailLoading && viewingOrder && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt</p>
              <p className="text-lg font-bold text-slate-900">{viewingOrder.receiptNumber}</p>
              {viewingOrder.sourceReceipt && (
                <p className="mt-1 text-xs font-medium text-amber-700">Eclipse POS Receipt: {viewingOrder.sourceReceipt}</p>
              )}
              <p className="mt-2 text-sm text-slate-700">{viewingOrder.outletName}</p>
              <p className="text-xs text-slate-500">{viewingOrder.outletAddress}</p>
              <p className="text-xs text-slate-500">{viewingOrder.outletPhone}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(viewingOrder.createdAt).toLocaleString("en-PH")} · {viewingOrder.sourceReceipt ? "POS Copy" : "Manual"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="pb-2">Item</th><th className="pb-2">Code</th><th className="pb-2">Unit</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Eclipse Price</th><th className="pb-2 text-right">IAO Price</th><th className="pb-2 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingOrder.items.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2 font-medium text-slate-900">{item.productName}</td>
                      <td className="py-2 text-slate-500">{item.productCode}</td>
                      <td className="py-2 text-slate-500">{item.unit}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-500">{item.eclipseReferenceUnitPrice !== undefined ? formatPrice(item.eclipseReferenceUnitPrice) : "—"}</td>
                      <td className="py-2 text-right">{formatPrice(item.sellingUnitPrice)}</td>
                      <td className="py-2 text-right font-semibold text-slate-900">{formatPrice(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div>
                <p className="text-sm text-slate-500">Grand total</p>
                <p className="text-xl font-bold text-slate-900">{formatPrice(viewingOrder.grandTotal)}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => printOrder(viewingOrder)}>
                <Printer size={16} /> Reprint
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <IAOOutletOrderReceiptPrint receipt={receiptToPrint} />
    </div>
  );
}
