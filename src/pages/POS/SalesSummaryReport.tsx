import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { useInventoryContext } from "../../context/InventoryContext";
import { useToast } from "../../context/ToastContext";
import {
  businessMonthStartKey,
  todayBusinessKey,
} from "../../utils/businessDate";
import {
  aggregateSales,
  downloadSalesSummary,
  loadSalesTransactions,
  SALES_AREAS,
  validateSalesFilters,
  type SalesInterval,
  type SalesSummaryFilters,
  type SalesTransaction,
} from "../../utils/posSalesSummary";

function getDefaultFilters(): SalesSummaryFilters {
  const today = todayBusinessKey();
  return {
    startDate: businessMonthStartKey(today),
    endDate: today,
    area: "ALL",
    outletName: "ALL",
    interval: "DAILY",
  };
}

function formatCents(cents: number) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return `₱${(safeCents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PAGE_SIZE = 10;

const INTERVAL_OPTIONS: { label: string; value: SalesInterval }[] = [
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
];

export default function SalesSummaryReport() {
  const { showToast } = useToast();
  const { outlets } = useInventoryContext();
  const [draft, setDraft] = useState<SalesSummaryFilters>(getDefaultFilters);
  const [applied, setApplied] = useState<SalesSummaryFilters>(draft);
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const requestVersion = useRef(0);

  const load = useCallback(async (filters: SalesSummaryFilters) => {
    const version = ++requestVersion.current;
    await Promise.resolve();
    if (version !== requestVersion.current) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await loadSalesTransactions(filters);
      if (version !== requestVersion.current) return;
      setTransactions(result);
      setApplied(filters);
      setPage(1);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      console.error("Unable to load sales summary:", loadError);
      setTransactions([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the sales summary."
      );
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitial() {
      await Promise.resolve();
      await load(getDefaultFilters());
    }
    void loadInitial();
  }, [load]);

  const outletOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        outlets
          .filter(
            (outlet) => draft.area === "ALL" || outlet.areaCode === draft.area
          )
          .map((outlet) => outlet.outletName)
      )
    ).sort((a, b) => a.localeCompare(b));
    return [
      { label: "All outlets", value: "ALL" },
      ...names.map((name) => ({ label: name, value: name })),
    ];
  }, [outlets, draft.area]);

  const { summary, periods } = useMemo(
    () =>
      aggregateSales(transactions, applied.interval, {
        startDate: applied.startDate,
        endDate: applied.endDate,
      }),
    [transactions, applied.interval, applied.startDate, applied.endDate]
  );

  const totalPages = Math.max(1, Math.ceil(periods.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visiblePeriods = periods.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function update<K extends keyof SalesSummaryFilters>(
    key: K,
    value: SalesSummaryFilters[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleApply() {
    const validationError = validateSalesFilters(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    void load(draft);
  }

  function handleReset() {
    const defaults = getDefaultFilters();
    setDraft(defaults);
    void load(defaults);
  }

  function handleExport() {
    try {
      downloadSalesSummary(applied, summary, periods);
    } catch (exportError) {
      console.error("Unable to export sales summary:", exportError);
      showToast("Unable to export the sales summary.", "error");
    }
  }

  const chartData = periods.map((period) => ({
    label: period.label,
    sales: period.totalCents / 100,
  }));
  const metrics = [
    { label: "Total Sales", value: formatCents(summary.totalCents) },
    { label: "Completed Transactions", value: summary.count.toLocaleString("en-PH") },
    { label: "Average Transaction Value", value: formatCents(summary.averageCents) },
    { label: "Total Items Sold", value: summary.quantity.toLocaleString("en-PH") },
  ];

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Sales Summary Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Active range: {applied.startDate} to {applied.endDate} (Asia/Manila)
            · {applied.area === "ALL" ? "All areas" : applied.area} ·{" "}
            {applied.outletName === "ALL" ? "All outlets" : applied.outletName}.
            Completed sales only.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleExport}
          disabled={isLoading || !!error}
        >
          Export Excel
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          id="sales-start-date"
          label="Start date"
          type="date"
          value={draft.startDate}
          onChange={(event) => update("startDate", event.target.value)}
        />
        <Input
          id="sales-end-date"
          label="End date"
          type="date"
          value={draft.endDate}
          onChange={(event) => update("endDate", event.target.value)}
        />
        <Select
          id="sales-area"
          label="Area"
          value={draft.area}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              area: event.target.value,
              outletName: "ALL",
            }))
          }
          options={[
            { label: "All areas", value: "ALL" },
            ...SALES_AREAS.map((area) => ({ label: area, value: area })),
          ]}
        />
        <Select
          id="sales-outlet"
          label="Outlet"
          value={draft.outletName}
          onChange={(event) => update("outletName", event.target.value)}
          options={outletOptions}
        />
        <Select
          id="sales-interval"
          label="Group by"
          value={draft.interval}
          onChange={(event) =>
            update("interval", event.target.value as SalesInterval)
          }
          options={INTERVAL_OPTIONS}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleApply} disabled={isLoading}>
          {isLoading ? "Loading..." : "Apply Filters"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleReset}
          disabled={isLoading}
        >
          Reset
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {isLoading ? "…" : metric.value}
            </p>
          </div>
        ))}
      </div>

      {!isLoading && !error && transactions.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No completed POS transactions match these filters. You can still
          export the zero-sales periods to Excel.
        </p>
      )}

      {periods.length > 0 && !isLoading && !error && (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => formatCents(Number(value) * 100)}
                />
                <Bar dataKey="sales" name="Total Sales" radius={[8, 8, 0, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Total Sales</th>
                  <th className="py-2 pr-4 text-right">Transactions</th>
                  <th className="py-2 pr-4 text-right">Average</th>
                  <th className="py-2 text-right">Items Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePeriods.map((period) => (
                  <tr key={period.key}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{period.label}</td>
                    <td className="py-2 pr-4 text-right">{formatCents(period.totalCents)}</td>
                    <td className="py-2 pr-4 text-right">{period.count}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatCents(period.averageCents)}
                    </td>
                    <td className="py-2 text-right">{period.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Page {currentPage} of {totalPages} · {periods.length}{" "}
              {periods.length === 1 ? "period" : "periods"}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
