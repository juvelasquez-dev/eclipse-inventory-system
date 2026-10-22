import * as XLSX from "xlsx";

import { supabase } from "../lib/supabase";
import {
  addBusinessDays,
  BUSINESS_TIMEZONE,
  businessDayStart,
} from "./businessDate";

const TRANSACTION_PAGE_SIZE = 500;
const ITEM_TRANSACTION_BATCH_SIZE = 50;
const ITEM_PAGE_SIZE = 500;
const PESO_FORMAT = '"₱"#,##0.00';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const RECEIPT_HEADERS = [
  "Date",
  "ReceiptId",
  "Cashier",
  "CustomerName",
  "CustomerNumber",
  "CustomerEmail",
  "NumberOfItems",
  "Total",
  "Subtotal",
  "TotalTax",
  "DeliveryCharges",
  "PackingCharges",
  "ServiceCharges",
  "CustomCharges",
  "Discount",
  "PaymentMode",
] as const;

export const RECEIPT_WITH_ITEMS_HEADERS = [
  "ReceiptId",
  "Date",
  "Cashier",
  "CustomerName",
  "CustomerNumber",
  "CustomerEmail",
  "EntryType",
  "EntryName",
  "EntryAmount",
  "NumberOfItems",
  "Total",
  "Subtotal",
  "TotalTax",
  "DeliveryCharges",
  "PackingCharges",
  "ServiceCharges",
  "CustomCharges",
  "Discount",
  "PaymentMode",
] as const;

interface ReportTransactionRow {
  id: string;
  delivery_receipt_sequence: number | null;
  area_code: string | null;
  receipt_number: number | null;
  created_by: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number | string;
  payment_method: string | null;
  created_at: string;
}

interface ReportItemRow {
  transaction_id: string;
  product_name_snapshot: string;
  unit_price: number | string;
  quantity: number | string;
  line_amount: number | string;
}

export interface ReportReceipt {
  id: string;
  date: string;
  receiptId: string;
  cashier: string;
  customerName: string;
  customerNumber: string;
  numberOfItems: number;
  total: number;
  paymentMode: string;
  items: { name: string; amount: number }[];
}

type CellValue = string | number | null;

export function validateReportDateRange(
  startKey: string,
  endKey: string
): string | null {
  if (!startKey || !endKey) {
    return "Select both a start date and an end date.";
  }
  if (!DATE_KEY_PATTERN.test(startKey) || !DATE_KEY_PATTERN.test(endKey)) {
    return "Enter valid dates.";
  }
  if (startKey > endKey) {
    return "The start date cannot be later than the end date.";
  }
  return null;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Matches the reference workbook, e.g. "Sep 1, 2025 10:03 AM". */
export function formatReportDate(value: string): string {
  const parts: Record<string, string> = {};
  for (const part of dateTimeFormatter.formatToParts(new Date(value))) {
    parts[part.type] = part.value;
  }
  return `${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function formatFileDate(key: string): string {
  const [year, month, day] = key.split("-");
  const monthName = new Date(Date.UTC(2000, Number(month) - 1, 1))
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}${monthName}${year.slice(2)}`;
}

export function getReportFileName(startKey: string, endKey: string): string {
  return `receipts-${formatFileDate(startKey)}-${formatFileDate(endKey)}.xlsx`;
}

function getDisplayReceiptNumber(row: ReportTransactionRow) {
  if (
    row.area_code &&
    row.receipt_number !== null &&
    row.receipt_number !== undefined
  ) {
    return `${row.area_code}-${String(row.receipt_number).padStart(4, "0")}`;
  }
  if (
    row.delivery_receipt_sequence !== null &&
    row.delivery_receipt_sequence !== undefined
  ) {
    return `DR-${String(row.delivery_receipt_sequence).padStart(4, "0")}`;
  }
  return "-";
}

function formatPaymentMode(method: string | null) {
  if (method === "CASH") return "Cash";
  if (method === "CHEQUE") return "Cheque";
  return method ?? "";
}

function toFiniteNumber(value: number | string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`A saved POS transaction has an invalid ${label}.`);
  }
  return parsed;
}

async function fetchTransactions(
  startKey: string,
  endKey: string
): Promise<ReportTransactionRow[]> {
  // Half-open range [start of start day, start of day after end day) in Manila time.
  const rangeStart = businessDayStart(startKey).toISOString();
  const rangeEnd = businessDayStart(addBusinessDays(endKey, 1)).toISOString();
  const rows: ReportTransactionRow[] = [];

  for (let from = 0; ; from += TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("pos_transactions")
      .select(
        "id, delivery_receipt_sequence, area_code, receipt_number, created_by, customer_name, customer_phone, subtotal, payment_method, created_at"
      )
      .eq("transaction_status", "COMPLETED")
      .gte("created_at", rangeStart)
      .lt("created_at", rangeEnd)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + TRANSACTION_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || "Unable to load POS transactions.");
    }

    const page = (data ?? []) as ReportTransactionRow[];
    rows.push(...page);
    if (page.length < TRANSACTION_PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchItems(
  transactionIds: string[]
): Promise<ReportItemRow[]> {
  const rows: ReportItemRow[] = [];

  for (
    let start = 0;
    start < transactionIds.length;
    start += ITEM_TRANSACTION_BATCH_SIZE
  ) {
    const batch = transactionIds.slice(
      start,
      start + ITEM_TRANSACTION_BATCH_SIZE
    );

    for (let from = 0; ; from += ITEM_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("pos_transaction_items")
        .select(
          "transaction_id, product_name_snapshot, unit_price, quantity, line_amount"
        )
        .in("transaction_id", batch)
        .order("transaction_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + ITEM_PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          error.message || "Unable to load POS transaction items."
        );
      }

      const page = (data ?? []) as ReportItemRow[];
      rows.push(...page);
      if (page.length < ITEM_PAGE_SIZE) break;
    }
  }

  return rows;
}

async function fetchCashierNames(
  userIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;

  const { data, error } = await supabase.rpc("get_cashier_usernames", {
    p_user_ids: userIds,
  });
  if (error) {
    console.error("Unable to resolve cashier usernames:", error);
    return names;
  }

  for (const cashier of (data ?? []) as {
    user_id: string | null;
    username: string | null;
  }[]) {
    if (cashier.user_id && cashier.username) {
      names.set(cashier.user_id, cashier.username);
    }
  }
  return names;
}

/** Loads every completed POS transaction in the range with its saved items. */
export async function loadPOSTransactionReport(
  startKey: string,
  endKey: string
): Promise<ReportReceipt[]> {
  const rangeError = validateReportDateRange(startKey, endKey);
  if (rangeError) throw new Error(rangeError);

  const transactions = await fetchTransactions(startKey, endKey);
  if (transactions.length === 0) return [];

  const itemRows = await fetchItems(transactions.map((row) => row.id));
  const itemsByTransaction = new Map<string, ReportItemRow[]>();
  for (const item of itemRows) {
    const list = itemsByTransaction.get(item.transaction_id) ?? [];
    list.push(item);
    itemsByTransaction.set(item.transaction_id, list);
  }

  const cashierNames = await fetchCashierNames(
    Array.from(
      new Set(
        transactions
          .map((row) => row.created_by)
          .filter((id): id is string => Boolean(id))
      )
    )
  );

  return transactions.map((row) => {
    const items = (itemsByTransaction.get(row.id) ?? []).map((item) => {
      const quantity = toFiniteNumber(item.quantity, "item quantity");
      const unitPrice = toFiniteNumber(item.unit_price, "item price");
      return {
        name: `${item.product_name_snapshot} (${quantity} X ${unitPrice})`,
        amount: toFiniteNumber(item.line_amount, "item amount"),
      };
    });

    return {
      id: row.id,
      date: formatReportDate(row.created_at),
      receiptId: getDisplayReceiptNumber(row),
      cashier:
        (row.created_by && cashierNames.get(row.created_by)) ||
        "Unknown cashier",
      customerName: row.customer_name ?? "",
      customerNumber: (row.customer_phone ?? "").trim(),
      numberOfItems: items.length,
      total: toFiniteNumber(row.subtotal, "total"),
      paymentMode: formatPaymentMode(row.payment_method),
      items,
    };
  });
}

// The POS records no email, tax, charges or discount, so these export blank/0.
function receiptTail(receipt: ReportReceipt): CellValue[] {
  return [
    receipt.total,
    receipt.total,
    0,
    0,
    0,
    0,
    0,
    0,
    receipt.paymentMode,
  ];
}

export function buildReceiptsRows(receipts: ReportReceipt[]): CellValue[][] {
  return receipts.map((receipt) => [
    receipt.date,
    receipt.receiptId,
    receipt.cashier,
    receipt.customerName,
    receipt.customerNumber,
    "",
    receipt.numberOfItems,
    ...receiptTail(receipt),
  ]);
}

export function buildReceiptsWithItemsRows(
  receipts: ReportReceipt[]
): CellValue[][] {
  const rows: CellValue[][] = [];

  for (const receipt of receipts) {
    rows.push([
      receipt.receiptId,
      receipt.date,
      receipt.cashier,
      receipt.customerName,
      receipt.customerNumber,
      "",
      null,
      null,
      null,
      receipt.numberOfItems,
      ...receiptTail(receipt),
    ]);

    for (const item of receipt.items) {
      rows.push([
        receipt.receiptId,
        null,
        null,
        null,
        null,
        null,
        "Item",
        item.name,
        item.amount,
        ...new Array<CellValue>(10).fill(null),
      ]);
    }
  }

  return rows;
}

function createSheet(
  headers: readonly string[],
  rows: CellValue[][],
  widths: number[],
  textColumns: number[],
  currencyColumns: number[]
): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...rows]);

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const address = XLSX.utils.encode_cell({
        r: rowIndex + 1,
        c: columnIndex,
      });
      const cell = sheet[address];
      if (!cell) return;
      if (textColumns.includes(columnIndex)) {
        cell.t = "s";
        cell.v = String(value ?? "");
      } else if (
        currencyColumns.includes(columnIndex) &&
        typeof value === "number"
      ) {
        cell.z = PESO_FORMAT;
      }
    });
  });

  sheet["!cols"] = widths.map((wch) => ({ wch }));
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(rows.length, 1), c: headers.length - 1 },
    }),
  };
  return sheet;
}

export function buildPOSTransactionWorkbook(
  receipts: ReportReceipt[]
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(
      RECEIPT_HEADERS,
      buildReceiptsRows(receipts),
      [22, 14, 26, 32, 16, 26, 14, 14, 14, 10, 15, 14, 14, 14, 12, 12],
      [4],
      [7, 8, 9, 10, 11, 12, 13, 14]
    ),
    "receipts"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(
      RECEIPT_WITH_ITEMS_HEADERS,
      buildReceiptsWithItemsRows(receipts),
      [14, 22, 26, 32, 16, 26, 11, 36, 14, 14, 14, 14, 10, 15, 14, 14, 14, 12, 12],
      [4],
      [8, 10, 11, 12, 13, 14, 15, 16, 17]
    ),
    "receiptsWithItems"
  );
  return workbook;
}

export function downloadPOSTransactionReport(
  receipts: ReportReceipt[],
  startKey: string,
  endKey: string
) {
  XLSX.writeFile(
    buildPOSTransactionWorkbook(receipts),
    getReportFileName(startKey, endKey)
  );
}
