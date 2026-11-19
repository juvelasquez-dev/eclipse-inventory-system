import * as XLSX from "xlsx";

import { supabase } from "../lib/supabase";
import {
  addBusinessDays,
  businessDayStart,
  businessMonthStartKey,
  businessWeekStartKey,
  toBusinessDateKey,
} from "./businessDate";
import {
  fetchItems,
  getReportFileName,
  validateReportDateRange,
} from "./posTransactionReport";

const TRANSACTION_PAGE_SIZE = 500;
const PESO_FORMAT = '"₱"#,##0.00';

export type SalesInterval = "DAILY" | "WEEKLY" | "MONTHLY";
export const SALES_AREAS = ["IAO", "CBR", "EFT"] as const;
export const EFT_SUBAREAS = ["EAST", "WEST", "LANAO", "BUKIDNON", "CGY"] as const;
export type EftSubarea = (typeof EFT_SUBAREAS)[number];
export type EftSubareaFilter = "ALL" | EftSubarea | "UNASSIGNED";

export interface SalesSummaryFilters {
  startDate: string;
  endDate: string;
  area: string; // "ALL" or an area code
  outletId: string; // "ALL" or a UUID
  outletLabel: string;
  interval: SalesInterval;
  subarea: EftSubareaFilter;
}

export interface SalesTransaction {
  id: string;
  createdAt: string;
  totalCents: number;
  quantity: number;
  areaCode: string | null;
  eftSubareaSnapshot: EftSubarea | null;
}

export interface EftSubareaSummary {
  subarea: EftSubarea | "UNASSIGNED";
  count: number;
  totalCents: number;
}

export function subareaLabel(subarea: EftSubareaFilter) {
  if (subarea === "ALL") return "All Subareas";
  return subarea === "UNASSIGNED" ? "Unassigned" : subarea;
}

export function eftTotalLabel(subarea: EftSubareaFilter) {
  return subarea === "ALL" ? "EFT Total" : "Filtered EFT Total";
}

export interface SalesPeriod {
  key: string;
  label: string;
  totalCents: number;
  count: number;
  quantity: number;
  averageCents: number;
}

export function safeAverageCents(totalCents: number, count: number) {
  const average = count > 0 ? Math.round(totalCents / count) : 0;
  return Number.isFinite(average) ? average : 0;
}

export interface SalesSummary {
  totalCents: number;
  count: number;
  quantity: number;
  averageCents: number;
}

interface SalesTransactionRow {
  id: string;
  total_amount: number | string;
  created_at: string;
  area_code: string | null;
  outlet_id: string | null;
  eft_subarea_snapshot: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const labelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

function keyToDate(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

export function getPeriodKey(createdAt: string, interval: SalesInterval) {
  const dayKey = toBusinessDateKey(createdAt);
  if (interval === "WEEKLY") return businessWeekStartKey(dayKey);
  if (interval === "MONTHLY") return businessMonthStartKey(dayKey);
  return dayKey;
}

export function getPeriodLabel(key: string, interval: SalesInterval) {
  if (interval === "MONTHLY") return monthFormatter.format(keyToDate(key));
  if (interval === "WEEKLY") {
    return `${labelFormatter.format(keyToDate(key))} – ${labelFormatter.format(
      keyToDate(addBusinessDays(key, 6))
    )}`;
  }
  return labelFormatter.format(keyToDate(key));
}

export function validateSalesFilters(
  filters: SalesSummaryFilters
): string | null {
  const dateError = validateReportDateRange(filters.startDate, filters.endDate);
  if (dateError) return dateError;
  if (
    filters.subarea !== "ALL" &&
    filters.subarea !== "UNASSIGNED" &&
    !EFT_SUBAREAS.some((subarea) => subarea === filters.subarea)
  ) {
    return "Select a valid EFT subarea.";
  }
  if (filters.subarea !== "ALL" && filters.area !== "EFT") {
    return "Select EFT to filter by subarea.";
  }
  if (filters.outletId !== "ALL" && !UUID_PATTERN.test(filters.outletId)) {
    return "Select a valid outlet.";
  }
  return null;
}

function toCents(value: number | string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`A saved POS transaction has an invalid ${label}.`);
  }
  return Math.round(parsed * 100);
}

/*
 * Each pos_transactions row is the current, final state of a sale: modifications
 * update the row in place (history lives in pos_transaction_revisions), so
 * filtering on COMPLETED counts every sale once and drops cancelled ones.
 */
async function fetchSalesTransactions(
  filters: SalesSummaryFilters
): Promise<SalesTransactionRow[]> {
  const rangeStart = businessDayStart(filters.startDate).toISOString();
  const rangeEnd = businessDayStart(
    addBusinessDays(filters.endDate, 1)
  ).toISOString();
  const rows: SalesTransactionRow[] = [];

  for (let from = 0; ; from += TRANSACTION_PAGE_SIZE) {
    let query = supabase
      .from("pos_transactions")
      .select(
        "id, total_amount, created_at, area_code, outlet_id, eft_subarea_snapshot"
      )
      .eq("transaction_status", "COMPLETED")
      .gte("created_at", rangeStart)
      .lt("created_at", rangeEnd);

    if (filters.area !== "ALL") query = query.eq("area_code", filters.area);
    if (filters.subarea === "UNASSIGNED") {
      query = query.is("eft_subarea_snapshot", null);
    } else if (filters.subarea !== "ALL") {
      query = query.eq("eft_subarea_snapshot", filters.subarea);
    }
    if (filters.outletId !== "ALL") {
      query = query.eq("outlet_id", filters.outletId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + TRANSACTION_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || "Unable to load POS transactions.");
    }

    const page = (data ?? []) as SalesTransactionRow[];
    rows.push(...page);
    if (page.length < TRANSACTION_PAGE_SIZE) break;
  }

  return rows;
}

export async function loadSalesTransactions(
  filters: SalesSummaryFilters
): Promise<SalesTransaction[]> {
  const rangeError = validateSalesFilters(filters);
  if (rangeError) throw new Error(rangeError);

  const rows = await fetchSalesTransactions(filters);
  if (rows.length === 0) return [];

  const items = await fetchItems(rows.map((row) => row.id));
  const quantityById = new Map<string, number>();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity)) {
      throw new Error("A saved POS transaction has an invalid item quantity.");
    }
    quantityById.set(
      item.transaction_id,
      (quantityById.get(item.transaction_id) ?? 0) + quantity
    );
  }

  return rows.map((row) => {
    const snapshot = row.eft_subarea_snapshot;
    if (snapshot !== null && !EFT_SUBAREAS.some((code) => code === snapshot)) {
      throw new Error("A saved POS transaction has an invalid EFT subarea snapshot.");
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      totalCents: toCents(row.total_amount, "total"),
      quantity: quantityById.get(row.id) ?? 0,
      areaCode: row.area_code,
      eftSubareaSnapshot: EFT_SUBAREAS.find((code) => code === snapshot) ?? null,
    };
  });
}

function nextPeriodKey(key: string, interval: SalesInterval) {
  if (interval === "DAILY") return addBusinessDays(key, 1);
  if (interval === "WEEKLY") return addBusinessDays(key, 7);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** Every period intersecting the inclusive date range, in order. */
export function buildEmptyPeriods(
  startDate: string,
  endDate: string,
  interval: SalesInterval
): SalesPeriod[] {
  const periods: SalesPeriod[] = [];
  let key = getPeriodKey(`${startDate}T00:00:00+08:00`, interval);
  const lastKey = getPeriodKey(`${endDate}T00:00:00+08:00`, interval);
  while (key <= lastKey) {
    periods.push({
      key,
      label: getPeriodLabel(key, interval),
      totalCents: 0,
      count: 0,
      quantity: 0,
      averageCents: 0,
    });
    key = nextPeriodKey(key, interval);
  }
  return periods;
}

export function aggregateSales(
  transactions: SalesTransaction[],
  interval: SalesInterval,
  range?: { startDate: string; endDate: string }
): { summary: SalesSummary; periods: SalesPeriod[] } {
  const byPeriod = new Map<string, SalesPeriod>();
  if (range) {
    for (const period of buildEmptyPeriods(
      range.startDate,
      range.endDate,
      interval
    )) {
      byPeriod.set(period.key, period);
    }
  }
  let totalCents = 0;
  let quantity = 0;

  for (const transaction of transactions) {
    const key = getPeriodKey(transaction.createdAt, interval);
    const period = byPeriod.get(key) ?? {
      key,
      label: getPeriodLabel(key, interval),
      totalCents: 0,
      count: 0,
      quantity: 0,
      averageCents: 0,
    };
    period.totalCents += transaction.totalCents;
    period.count += 1;
    period.quantity += transaction.quantity;
    period.averageCents = safeAverageCents(period.totalCents, period.count);
    byPeriod.set(key, period);
    totalCents += transaction.totalCents;
    quantity += transaction.quantity;
  }

  const count = transactions.length;
  return {
    summary: {
      totalCents,
      count,
      quantity,
      averageCents: safeAverageCents(totalCents, count),
    },
    periods: Array.from(byPeriod.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
  };
}

export function filterPeriodsWithTransactions(periods: SalesPeriod[]) {
  return periods.filter((period) => period.count > 0);
}

export function aggregateEftSubareas(
  transactions: SalesTransaction[],
  selected: EftSubareaFilter
): EftSubareaSummary[] {
  const categories: EftSubareaSummary["subarea"][] = [...EFT_SUBAREAS, "UNASSIGNED"];
  const summaries = categories
    .filter((subarea) => selected === "ALL" || selected === subarea)
    .map((subarea) => ({ subarea, count: 0, totalCents: 0 }));
  for (const transaction of transactions) {
    if (transaction.areaCode !== "EFT") continue;
    const subarea = transaction.eftSubareaSnapshot ?? "UNASSIGNED";
    const summary = summaries.find((entry) => entry.subarea === subarea);
    if (!summary) {
      throw new Error("A transaction does not match the selected EFT subarea.");
    }
    summary.count += 1;
    summary.totalCents += transaction.totalCents;
  }
  return summaries;
}

const INTERVAL_LABELS: Record<SalesInterval, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

export function getSalesSummaryFileName(filters: SalesSummaryFilters) {
  return getReportFileName(filters.startDate, filters.endDate).replace(
    /^receipts-/,
    "sales-summary-"
  );
}

export function buildSalesSummaryWorkbook(
  filters: SalesSummaryFilters,
  summary: SalesSummary,
  periods: SalesPeriod[],
  subareas: EftSubareaSummary[]
): XLSX.WorkBook {
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Metric", "Value"],
    ["Start Date", filters.startDate],
    ["End Date", filters.endDate],
    ["Area", filters.area === "ALL" ? "All" : filters.area],
    [
      "Outlet",
      filters.outletLabel === "ALL" ? "All" : filters.outletLabel,
    ],
    ["Grouping", INTERVAL_LABELS[filters.interval]],
    ["Total Sales", summary.totalCents / 100],
    ["Completed Transaction Count", summary.count],
    ["Average Transaction Value", summary.averageCents / 100],
    ["Total Items Sold", summary.quantity],
  ]);
  for (const address of ["B7", "B9"]) summarySheet[address].z = PESO_FORMAT;
  if (filters.area === "EFT") {
    XLSX.utils.sheet_add_aoa(summarySheet, [
      ["EFT Subarea", subareaLabel(filters.subarea)],
    ], { origin: -1 });
  }
  summarySheet["!cols"] = [{ wch: 30 }, { wch: 24 }];

  const breakdownRows = periods.map((period) => [
    period.label,
    period.totalCents / 100,
    period.count,
    safeAverageCents(period.totalCents, period.count) / 100,
    period.quantity,
  ]);
  const breakdownSheet = XLSX.utils.aoa_to_sheet([
    [
      "Period",
      "Total Sales",
      "Transaction Count",
      "Average Transaction Value",
      "Items Sold",
    ],
    ...breakdownRows,
  ]);
  breakdownRows.forEach((_, index) => {
    for (const column of ["B", "D"]) {
      breakdownSheet[`${column}${index + 2}`].z = PESO_FORMAT;
    }
  });
  breakdownSheet["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 26 }, { wch: 12 }];
  breakdownSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(breakdownRows.length, 1), c: 4 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, breakdownSheet, "Breakdown");
  if (filters.area === "ALL" || filters.area === "EFT") {
    const subareaRows = subareas.map((entry) => [
      subareaLabel(entry.subarea),
      entry.totalCents / 100,
      entry.count,
    ]);
    const subareaSheet = XLSX.utils.aoa_to_sheet([
      ["EFT Subarea", "Total Sales", "Transaction Count"],
      ...subareaRows,
      [
        eftTotalLabel(filters.subarea),
        subareas.reduce((total, entry) => total + entry.totalCents, 0) / 100,
        subareas.reduce((total, entry) => total + entry.count, 0),
      ],
    ]);
    for (let row = 2; row <= subareaRows.length + 2; row += 1) {
      subareaSheet[`B${row}`].z = PESO_FORMAT;
    }
    subareaSheet["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, subareaSheet, "EFT Subareas");
  }
  return workbook;
}

export function downloadSalesSummary(
  filters: SalesSummaryFilters,
  summary: SalesSummary,
  periods: SalesPeriod[],
  subareas: EftSubareaSummary[]
) {
  XLSX.writeFile(
    buildSalesSummaryWorkbook(filters, summary, periods, subareas),
    getSalesSummaryFileName(filters)
  );
}
