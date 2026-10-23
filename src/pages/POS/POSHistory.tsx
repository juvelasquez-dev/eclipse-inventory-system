import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import A5DeliveryReceiptPrint from "../../components/pos/A5DeliveryReceiptPrint";
import DeliveryReceiptPrint, {
  type ReceiptData,
} from "../../components/pos/DeliveryReceiptPrint";
import POSOrderEditor, {
  type EditablePOSTransaction,
} from "../../components/pos/POSOrderEditor";
import { useInventoryContext } from "../../context/InventoryContext";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";
import { sortByProductGroup } from "../../utils/productGroupOrder";
import {
  printReceipt as printReceiptInFormat,
  type ReceiptPrintFormat,
} from "../../utils/receiptPrinting";
import {
  getA5ReceiptCatalogIssue,
  getA5ReceiptDataIssue,
} from "../../utils/a5DeliveryReceipt";
import {
  addBusinessDays,
  businessMonthStartKey,
  businessWeekStartKey,
  todayBusinessKey,
  toBusinessDateKey,
} from "../../utils/businessDate";
import {
  cancellationRetryStorageKey,
  clearSessionAttempt,
  createRetryAttemptTimestamp,
  POS_RETRY_ATTEMPT_VERSION,
  POS_RETRY_ATTEMPT_TTL_MS,
  readCancellationAttempt,
  type CancellationRetryAttempt,
  type StoredAttemptResult,
  writeSessionAttempt,
} from "../../utils/posRetryRecovery";

interface POSHistoryRow extends ReceiptData {
  id: string;
  cashierUsername: string;
  createdBy: string | null;
  areaCode: string | null;
  transactionStatus: string;
  cancelledAt: string | null;
  cancelledByUsername: string;
  cancellationReason: string;
  revisionNumber: number;
}

interface POSHistoryDbRow {
  id: string;
  delivery_receipt_sequence: number | null;
  area_code: string | null;
  receipt_number: number | null;
  created_by: string | null;
  customer_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  subtotal: number | string;
  amount_received: number | string;
  change_amount: number | string;
  payment_method: string | null;
  transaction_status: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  revision_number: number;
}

interface POSHistoryItemRow {
  transaction_id: string;
  product_id: string;
  product_name_snapshot: string;
  product_code_snapshot: string;
  unit_snapshot: string;
  unit_price: number | string;
  quantity: number;
  line_amount: number | string;
}

interface POSHistorySnapshot {
  transaction: POSHistoryDbRow;
  items: POSHistoryItemRow[];
}

interface POSAuditRevision {
  revision_number: number;
  snapshot: POSHistorySnapshot;
  actor_user_id: string | null;
  reason: string | null;
  created_at: string;
}

interface POSAuditEvent {
  event_type: string;
  revision_number: number;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | null;
  reason: string | null;
  created_at: string;
  details: Record<string, unknown>;
}

interface POSAudit {
  transaction_id: string;
  revision_number: number;
  copied_to_iao: boolean;
  revisions: POSAuditRevision[];
  events: POSAuditEvent[];
}

const ITEM_TRANSACTION_BATCH_SIZE = 50;
const ITEM_PAGE_SIZE = 500;

/*
 * Supabase caps rows per request, so items are fetched in batches of
 * transaction IDs, paging within each batch. Any failed page throws, so a
 * partial result is never treated as an empty item list. Returns null only
 * when the caller's request has been superseded.
 */
async function fetchAllPOSItems(
  transactionIds: string[],
  isCurrentRequest: () => boolean
): Promise<POSHistoryItemRow[] | null> {
  const rows: POSHistoryItemRow[] = [];

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
          "transaction_id, product_id, product_name_snapshot, product_code_snapshot, unit_snapshot, unit_price, quantity, line_amount"
        )
        .in("transaction_id", batch)
        .order("transaction_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + ITEM_PAGE_SIZE - 1);

      if (!isCurrentRequest()) return null;
      if (error) {
        throw new Error(
          error.message || "Unable to load POS transaction items."
        );
      }

      const page = (data ?? []) as POSHistoryItemRow[];
      rows.push(...page);

      if (page.length < ITEM_PAGE_SIZE) break;
    }
  }

  return rows;
}

type CancellationRecoveryStatus =
  | StoredAttemptResult<CancellationRetryAttempt>
  | { status: "loading" | "auth-unavailable" };

function getDisplayReceiptNumber(row: POSHistoryDbRow) {
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

function mapHistoryRow(
  row: POSHistoryDbRow,
  itemRows: POSHistoryItemRow[],
  cashierUsername: string,
  cancelledByUsername: string
): POSHistoryRow {
  const items = itemRows.map(
    (item) => ({
      product: {
        id: item.product_id,
        code: item.product_code_snapshot,
        name: item.product_name_snapshot,
        category: "",
        unit: item.unit_snapshot,
        price: Number(item.unit_price),
        minimumStock: 0,
      },
      quantity: Number(item.quantity),
    })
  );

  return {
    id: row.id,
    deliveryReceiptNumber: getDisplayReceiptNumber(row),
    cashierUsername,
    createdBy: row.created_by || null,
    areaCode: row.area_code?.trim() || null,
    customerName: row.customer_name ?? "",
    customerAddress: row.customer_address ?? "",
    customerPhone: row.customer_phone ?? "",
    amountReceived: Number(row.amount_received),
    paymentMethod: row.payment_method ?? "",
    createdAt: row.created_at,
    items,
    subtotal: Number(row.subtotal),
    changeAmount: Number(row.change_amount),
    transactionStatus: row.transaction_status ?? "",
    cancelledAt: row.cancelled_at ?? null,
    cancelledByUsername,
    cancellationReason: row.cancellation_reason ?? "",
    revisionNumber: Number(row.revision_number ?? 1),
  };
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPaymentMethod(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "CHEQUE") return "Cheque";
  return method;
}

/*
 * =========================================================
 * DATE FILTER HELPERS
 * =========================================================
 */

function matchesDateFilter(
  createdAt: string,
  dateFilter: string,
  customStart: string,
  customEnd: string
) {
  if (dateFilter === "ALL") {
    return true;
  }

  // Compare Asia/Manila calendar dates (YYYY-MM-DD keys sort chronologically).
  const txKey = toBusinessDateKey(createdAt);
  const todayKey = todayBusinessKey();

  if (dateFilter === "TODAY") {
    return txKey === todayKey;
  }

  if (dateFilter === "YESTERDAY") {
    return txKey === addBusinessDays(todayKey, -1);
  }

  if (dateFilter === "THIS_WEEK") {
    return txKey >= businessWeekStartKey(todayKey);
  }

  if (dateFilter === "THIS_MONTH") {
    return txKey >= businessMonthStartKey(todayKey);
  }

  if (dateFilter === "CUSTOM") {
    if (!customStart && !customEnd) {
      return true;
    }

    if (customStart && txKey < customStart) return false;

    if (customEnd && txKey > customEnd) return false;

    return true;
  }

  return true;
}

/*
 * =========================================================
 * ITEM SUMMARY HELPERS
 * =========================================================
 */

function getItemsSummary(items: POSHistoryRow["items"]) {
  if (items.length === 0) return "No items";
  if (items.length === 1) return items[0].product.name;
  return `${items[0].product.name} + ${items.length - 1} more`;
}

function getTotalQuantity(items: POSHistoryRow["items"]) {
  return items.reduce(
    (total, item) => total + item.quantity,
    0
  );
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const UNKNOWN_CASHIER_FILTER = "__UNKNOWN_CASHIER__";

export default function POSHistory() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    refreshInventory,
    products,
    inventory,
    inventorySyncStatus,
    isLoading: catalogLoading,
    loadError: catalogLoadError,
  } = useInventoryContext();
  const a5CatalogIssue = getA5ReceiptCatalogIssue(
    products,
    inventory,
    catalogLoading,
    catalogLoadError
  );
  const [transactions, setTransactions] =
    useState<POSHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] =
    useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedTransaction, setSelectedTransaction] =
    useState<POSHistoryRow | null>(null);
  const [receipt, setReceipt] =
    useState<POSHistoryRow | null>(null);
  const [printRequested, setPrintRequested] =
    useState(false);
  const [printFormat, setPrintFormat] =
    useState<ReceiptPrintFormat>("thermal");
  const [cancellationTarget, setCancellationTarget] =
    useState<POSHistoryRow | null>(null);
  const [cancellationReason, setCancellationReason] =
    useState("");
  const [editingTransaction, setEditingTransaction] =
    useState<EditablePOSTransaction | null>(null);
  const [transactionAudit, setTransactionAudit] =
    useState<POSAudit | null>(null);
  const [auditLoading, setAuditLoading] =
    useState(false);
  const activeAuditTransactionId = useRef<string | null>(null);
  const [isCancelling, setIsCancelling] =
    useState(false);
  const cancellationSubmissionLock = useRef(false);
  const [cancellationUserId, setCancellationUserId] =
    useState<string | null>(null);
  const cancellationUserIdRef = useRef<string | null>(null);
  const cancellationAuthEventVersion = useRef(0);
  const [historyLoadTrigger, setHistoryLoadTrigger] = useState(0);
  const historyLoadRequestVersion = useRef(0);
  const [cancellationRecovery, setCancellationRecovery] =
    useState<CancellationRecoveryStatus>({ status: "loading" });
  const [confirmCancellationDiscard, setConfirmCancellationDiscard] =
    useState(false);
  const [confirmExpiredCancellationRetry, setConfirmExpiredCancellationRetry] =
    useState(false);
  const [historyRefreshVersion, setHistoryRefreshVersion] =
    useState(0);

  /*
   * =========================================================
   * FILTER / SORT / PAGINATION STATE (UI-only, client-side)
   * =========================================================
   */

  const [dateFilter, setDateFilter] =
    useState("ALL");
  const [customStart, setCustomStart] =
    useState("");
  const [customEnd, setCustomEnd] =
    useState("");
  const [paymentFilter, setPaymentFilter] =
    useState("ALL");
  const [cashierFilter, setCashierFilter] =
    useState("ALL");
  const [areaFilter, setAreaFilter] =
    useState("ALL");
  const [sortBy, setSortBy] =
    useState("NEWEST");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!receipt || !printRequested) {
      return;
    }

    const printTimer = window.setTimeout(() => {
      try {
        printReceiptInFormat(printFormat);
      } catch (error) {
        console.error("Unable to open the receipt print dialog:", error);
        showToast(
          "The print dialog could not be opened. The saved transaction is unchanged.",
          "error"
        );
      }
      setPrintRequested(false);
    }, 0);

    return () => window.clearTimeout(printTimer);
  }, [receipt, printFormat, printRequested, showToast]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const userId = session?.user.id ?? null;
        cancellationAuthEventVersion.current += 1;
        setHistoryLoadTrigger((version) => version + 1);
        cancellationUserIdRef.current = userId;
        setCancellationUserId(userId);
        setCancellationRecovery(
          userId
            ? readCancellationAttempt(userId)
            : { status: "auth-unavailable" }
        );
      }
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const requestVersion = ++historyLoadRequestVersion.current;
    const authEventVersion = cancellationAuthEventVersion.current;
    let isActive = true;
    const isCurrentRequest = () =>
      isActive &&
      requestVersion === historyLoadRequestVersion.current &&
      authEventVersion === cancellationAuthEventVersion.current;

    async function loadTransactions() {
      try {
        await Promise.resolve();
        if (!isCurrentRequest()) return;
        setLoading(true);
        setLoadError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!isCurrentRequest()) return;
        if (authError || !user) {
          cancellationUserIdRef.current = null;
          setCancellationRecovery({ status: "auth-unavailable" });
          navigate("/login", { replace: true });
          return;
        }
        cancellationUserIdRef.current = user.id;
        setCancellationUserId(user.id);
        setCancellationRecovery(readCancellationAttempt(user.id));

        const { data, error } = await supabase
          .from("pos_transactions")
          .select(
            "id, delivery_receipt_sequence, area_code, receipt_number, created_by, customer_name, customer_address, customer_phone, subtotal, amount_received, change_amount, payment_method, transaction_status, created_at, cancelled_at, cancelled_by, cancellation_reason, revision_number"
          )
          .order("created_at", {
            ascending: false,
          });

        if (!isCurrentRequest()) return;
        if (error) throw new Error(error.message || "Unable to load POS transaction history.");

        const transactionIds = (data ?? []).map((row) => row.id);
        const itemRows = await fetchAllPOSItems(
          transactionIds,
          isCurrentRequest
        );
        if (!itemRows || !isCurrentRequest()) return;

        const { data: profileUsername, error: usernameError } =
          await supabase.rpc("get_current_username");

        if (!isCurrentRequest()) return;
        if (usernameError) {
          console.error("Unable to load current username:", usernameError);
        }

        const currentUsername = profileUsername || "Unknown cashier";
        const cashierUserIds = Array.from(
          new Set(
            (data ?? [])
              .flatMap((row) => [row.created_by, row.cancelled_by])
              .filter(Boolean)
          )
        );
        const cashierUsernameById = new Map<string, string>();

        if (cashierUserIds.length > 0) {
          const {
            data: cashierRows,
            error: cashierError,
          } = await supabase.rpc("get_cashier_usernames", {
            p_user_ids: cashierUserIds,
          });

          if (!isCurrentRequest()) return;
          if (cashierError) {
            console.error("Unable to resolve cashier usernames:", cashierError);
          } else {
            (cashierRows ?? []).forEach((cashier: any) => {
              if (cashier.user_id && cashier.username) {
                cashierUsernameById.set(cashier.user_id, cashier.username);
              }
            });
          }
        }

        if (!isCurrentRequest()) return;
        setTransactions(
          (data ?? []).map((row) =>
            mapHistoryRow(
              row,
              itemRows.filter((item) => item.transaction_id === row.id),
              cashierUsernameById.get(row.created_by) ||
                (row.created_by === user.id ? currentUsername : "Unknown cashier"),
              cashierUsernameById.get(row.cancelled_by) ||
                (row.cancelled_by === user.id ? currentUsername : "Unknown user")
            )
          )
        );
      } catch (error) {
        if (!isCurrentRequest()) return;
        const message = error instanceof Error
          ? error.message
          : "Unable to load POS transaction history.";
        console.error("Unable to load POS transaction history:", error);
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    }

    void loadTransactions();
    return () => {
      isActive = false;
    };
  }, [navigate, showToast, historyRefreshVersion, historyLoadTrigger]);

  /*
   * =========================================================
   * FILTERING
   * =========================================================
   */

  const cashierOptions = useMemo(() => {
    const byId = new Map<string, string>();
    let hasUnknown = false;

    transactions.forEach((transaction) => {
      if (!transaction.createdBy) {
        hasUnknown = true;
        return;
      }
      if (!byId.has(transaction.createdBy)) {
        byId.set(transaction.createdBy, transaction.cashierUsername);
      }
    });

    const labelCounts = new Map<string, number>();
    byId.forEach((label) =>
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
    );

    const options = Array.from(byId, ([id, label]) => ({
      value: id,
      label:
        (labelCounts.get(label) ?? 0) > 1
          ? `${label} (${id.slice(0, 8)})`
          : label,
    })).sort((a, b) => a.label.localeCompare(b.label));

    if (hasUnknown) {
      options.push({
        value: UNKNOWN_CASHIER_FILTER,
        label: "Unknown cashier (not recorded)",
      });
    }

    return [{ label: "All Cashiers", value: "ALL" }, ...options];
  }, [transactions]);

  const areaOptions = useMemo(() => {
    const areas = Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.areaCode)
          .filter((area): area is string => Boolean(area))
      )
    ).sort();

    return [
      { label: "All Areas", value: "ALL" },
      ...areas.map((area) => ({ label: area, value: area })),
    ];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !keyword ||
        transaction.deliveryReceiptNumber
          .toLowerCase()
          .includes(keyword) ||
        transaction.customerName
          .toLowerCase()
          .includes(keyword) ||
        transaction.customerPhone
          .toLowerCase()
          .includes(keyword) ||
        transaction.cashierUsername
          .toLowerCase()
          .includes(keyword);

      const matchesStatus =
        status === "ALL" ||
        transaction.transactionStatus === status;

      const matchesPayment =
        paymentFilter === "ALL" ||
        transaction.paymentMethod === paymentFilter;

      const matchesCashier =
        cashierFilter === "ALL" ||
        (cashierFilter === UNKNOWN_CASHIER_FILTER
          ? !transaction.createdBy
          : transaction.createdBy === cashierFilter);

      const matchesArea =
        areaFilter === "ALL" ||
        transaction.areaCode === areaFilter;

      const matchesDate = matchesDateFilter(
        transaction.createdAt,
        dateFilter,
        customStart,
        customEnd
      );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesCashier &&
        matchesArea &&
        matchesDate
      );
    });
  }, [
    transactions,
    search,
    status,
    paymentFilter,
    cashierFilter,
    areaFilter,
    dateFilter,
    customStart,
    customEnd,
  ]);

  const hasFilters =
    search.trim() !== "" ||
    status !== "ALL" ||
    paymentFilter !== "ALL" ||
    cashierFilter !== "ALL" ||
    areaFilter !== "ALL" ||
    dateFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatus("ALL");
    setPaymentFilter("ALL");
    setCashierFilter("ALL");
    setAreaFilter("ALL");
    setDateFilter("ALL");
    setCustomStart("");
    setCustomEnd("");
  }

  /*
   * =========================================================
   * SORTING
   * =========================================================
   */

  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];

    switch (sortBy) {
      case "OLDEST":
        return list.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

      case "AMOUNT_HIGH":
        return list.sort(
          (a, b) => b.subtotal - a.subtotal
        );

      case "AMOUNT_LOW":
        return list.sort(
          (a, b) => a.subtotal - b.subtotal
        );

      case "QTY_HIGH":
        return list.sort(
          (a, b) =>
            getTotalQuantity(b.items) -
            getTotalQuantity(a.items)
        );

      case "QTY_LOW":
        return list.sort(
          (a, b) =>
            getTotalQuantity(a.items) -
            getTotalQuantity(b.items)
        );

      case "NEWEST":
      default:
        return list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );
    }
  }, [filteredTransactions, sortBy]);

  /*
   * =========================================================
   * SUMMARY CARDS (based on the filtered set)
   * =========================================================
   */

  const summary = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const completedTransactions = filteredTransactions.filter(
      (transaction) =>
        transaction.transactionStatus === "COMPLETED"
    );

    const totalSales = completedTransactions.reduce(
      (total, transaction) => total + transaction.subtotal,
      0
    );

    const totalItemsSold = completedTransactions.reduce(
      (total, transaction) =>
        total + getTotalQuantity(transaction.items),
      0
    );

    const averageValue =
      completedTransactions.length > 0
        ? totalSales / completedTransactions.length
        : 0;

    return {
      totalTransactions,
      totalSales,
      totalItemsSold,
      averageValue,
    };
  }, [filteredTransactions]);

  /*
   * =========================================================
   * PAGINATION
   * =========================================================
   */

  const totalPages = Math.max(
    1,
    Math.ceil(sortedTransactions.length / pageSize)
  );

  const paginatedTransactions = sortedTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    status,
    paymentFilter,
    cashierFilter,
    areaFilter,
    dateFilter,
    customStart,
    customEnd,
    sortBy,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        Math.abs(i - page) <= 1
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }

    return pages;
  }, [totalPages, page]);

  function openDetails(transaction: POSHistoryRow) {
    setSelectedTransaction(transaction);
    setTransactionAudit(null);
    activeAuditTransactionId.current = transaction.id;
    void loadTransactionAudit(transaction.id);
  }

  function closeDetails() {
    setSelectedTransaction(null);
    setReceipt(null);
    setTransactionAudit(null);
    activeAuditTransactionId.current = null;
  }

  function printTransaction(
    transaction: POSHistoryRow,
    format: ReceiptPrintFormat
  ) {
    const printIssue =
      a5CatalogIssue ??
      getA5ReceiptDataIssue(transaction, products, inventory);
    if (format === "a4-two-copy" && printIssue) {
      showToast(printIssue, "error");
      return;
    }
    setReceipt(transaction);
    setPrintFormat(format);
    setPrintRequested(true);
  }

  function openCancellation(transaction: POSHistoryRow) {
    setCancellationTarget(transaction);
    setCancellationReason(
      cancellationRecovery.status !== "missing" &&
        "attempt" in cancellationRecovery &&
        cancellationRecovery.attempt.transactionId === transaction.id
        ? cancellationRecovery.attempt.reason
        : ""
    );
  }

  function closeCancellation() {
    if (isCancelling) return;
    setCancellationTarget(null);
    setCancellationReason("");
  }

  async function cancelTransaction() {
    if (
      !cancellationTarget ||
      cancellationSubmissionLock.current ||
      !cancellationUserId ||
      cancellationUserId !== cancellationUserIdRef.current
    ) return;
    const normalizedReason = cancellationReason.trim();
    if (cancellationRecovery.status !== "missing") {
      const existingAttempt =
        "attempt" in cancellationRecovery
          ? cancellationRecovery.attempt
          : null;
      if (
        cancellationRecovery.status !== "valid" ||
        !existingAttempt ||
        existingAttempt.userId !== cancellationUserId ||
        existingAttempt.transactionId !== cancellationTarget.id ||
        existingAttempt.reason !== normalizedReason
      ) {
        showToast(
          "Resolve the saved cancellation first. Retry the exact transaction and reason, or explicitly discard it before starting another cancellation.",
          "error"
        );
        return;
      }
      await submitCancellationAttempt(existingAttempt);
      return;
    }

    const attempt: CancellationRetryAttempt = {
      version: POS_RETRY_ATTEMPT_VERSION,
      requestId: crypto.randomUUID(),
      userId: cancellationUserId,
      transactionId: cancellationTarget.id,
      reason: normalizedReason,
      createdAt: createRetryAttemptTimestamp(),
    };
    if (
      !writeSessionAttempt(
        cancellationRetryStorageKey(cancellationUserId),
        attempt
      )
    ) {
      setCancellationRecovery({ status: "unavailable" });
      setCancellationTarget(null);
      setCancellationReason("");
      showToast(
        "Session storage is unavailable. Cancellation was not sent because reload-safe recovery cannot be guaranteed.",
        "error"
      );
      return;
    }
    setCancellationRecovery({ status: "valid", attempt });
    await submitCancellationAttempt(attempt);
  }

  async function retryPreviousCancellation() {
    if (
      cancellationSubmissionLock.current ||
      cancellationRecovery.status !== "valid" ||
      cancellationRecovery.attempt.userId !== cancellationUserId ||
      cancellationRecovery.attempt.userId !== cancellationUserIdRef.current
    ) {
      return;
    }
    const latestAttempt = readCancellationAttempt(cancellationUserId);
    setCancellationRecovery(latestAttempt);
    if (latestAttempt.status !== "valid") return;
    await submitCancellationAttempt(latestAttempt.attempt);
  }

  async function continueExpiredCancellationRecovery() {
    if (
      cancellationSubmissionLock.current ||
      cancellationRecovery.status !== "expired" ||
      cancellationRecovery.attempt.userId !== cancellationUserId ||
      cancellationRecovery.attempt.userId !== cancellationUserIdRef.current
    ) {
      return;
    }
    const latestAttempt = readCancellationAttempt(cancellationUserId);
    setCancellationRecovery(latestAttempt);
    if (latestAttempt.status !== "expired") return;
    setConfirmExpiredCancellationRetry(false);
    await submitCancellationAttempt(latestAttempt.attempt);
  }

  async function submitCancellationAttempt(
    attempt: CancellationRetryAttempt
  ) {
    if (
      cancellationSubmissionLock.current ||
      isCancelling ||
      attempt.userId !== cancellationUserIdRef.current ||
      attempt.userId !== cancellationUserId
    ) return;
    cancellationSubmissionLock.current = true;
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.rpc(
        "cancel_pos_transaction_with_request",
        {
          p_transaction_id: attempt.transactionId,
          p_cancellation_reason: attempt.reason,
          p_request_id: attempt.requestId,
        }
      );

      if (error) throw error;

      if (
        typeof data !== "object" ||
        data === null ||
        !("transaction_id" in data) ||
        !("transaction_status" in data) ||
        !("display_receipt_number" in data) ||
        data.transaction_id !== attempt.transactionId ||
        data.transaction_status !== "CANCELLED" ||
        typeof data.display_receipt_number !== "string" ||
        data.display_receipt_number.length === 0
      ) {
        setCancellationTarget(null);
        setCancellationReason("");
        showToast(
          "Cancellation may have completed, but its confirmation was incomplete. Retrying sends the same request ID; whether the server returns the earlier result depends on its idempotency record. Check transaction history before discarding this attempt.",
          "error"
        );
        return;
      }

      const cleared = clearSessionAttempt(
        cancellationRetryStorageKey(attempt.userId)
      );
      if (cancellationUserIdRef.current !== attempt.userId) return;
      if (cleared) {
        setCancellationRecovery({ status: "missing" });
        setConfirmCancellationDiscard(false);
      }
      setSelectedTransaction(null);
      setTransactionAudit(null);
      setCancellationTarget(null);
      setCancellationReason("");
      setHistoryRefreshVersion((version) => version + 1);
      showToast(cleared
        ? `Order ${data.display_receipt_number} cancelled and inventory restored.`
        : `Order ${data.display_receipt_number} is cancelled. The retry record could not be cleared; resolve it before starting another cancellation.`,
        cleared ? "success" : "error"
      );
      try {
        await refreshInventory();
      } catch (error) {
        console.error("Cancellation succeeded, but inventory refresh failed:", error);
        showToast(
          "Cancellation succeeded, but inventory could not be refreshed. Refresh the inventory view before relying on its displayed stock.",
          "error"
        );
      }
    } catch (error) {
      setCancellationTarget(null);
      setCancellationReason("");
      console.error("Unable to cancel POS transaction:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Cancellation confirmation is uncertain. The saved attempt is retained; retry it before starting another cancellation.",
        "error"
      );
    } finally {
      cancellationSubmissionLock.current = false;
      setIsCancelling(false);
    }
  }

  function discardCancellationAttempt() {
    if (
      cancellationSubmissionLock.current ||
      !cancellationUserId ||
      cancellationUserId !== cancellationUserIdRef.current
    ) return;
    if (!clearSessionAttempt(cancellationRetryStorageKey(cancellationUserId))) {
      setCancellationRecovery({ status: "unavailable" });
      showToast("Unable to remove the saved cancellation attempt from this tab.", "error");
      return;
    }
    setCancellationRecovery({ status: "missing" });
    setConfirmCancellationDiscard(false);
    setConfirmExpiredCancellationRetry(false);
  }

  async function loadTransactionAudit(
    transactionId: string
  ): Promise<POSAudit | null> {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_pos_transaction_audit",
        { p_transaction_id: transactionId }
      );
      if (error) throw error;
      const audit = data as POSAudit;
      if (activeAuditTransactionId.current === transactionId) {
        setTransactionAudit(audit);
      }
      return audit;
    } catch (error) {
      console.error("Unable to load POS transaction audit:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Unable to verify this POS transaction's history.",
        "error"
      );
      return null;
    } finally {
      setAuditLoading(false);
    }
  }

  async function startEditing(transaction: POSHistoryRow) {
    const audit =
      transactionAudit?.transaction_id === transaction.id
        ? transactionAudit
        : await loadTransactionAudit(transaction.id);
    if (!audit) return;
    if (audit.copied_to_iao) {
      showToast(
        "This POS transaction cannot be changed because it has already been copied to an IAO order.",
        "error"
      );
      return;
    }
    setEditingTransaction({
      id: transaction.id,
      revisionNumber: transaction.revisionNumber,
      receiptNumber: transaction.deliveryReceiptNumber,
      transactionStatus: transaction.transactionStatus,
      customerName: transaction.customerName,
      customerAddress: transaction.customerAddress,
      customerPhone: transaction.customerPhone,
      items: transaction.items,
    });
    setCancellationTarget(null);
  }

  async function handleModificationSaved(
    committedTotal: number,
    wasReopening: boolean
  ) {
    setEditingTransaction(null);
    setSelectedTransaction(null);
    setTransactionAudit(null);
    await refreshInventory();
    setHistoryRefreshVersion((version) => version + 1);
    showToast(
      wasReopening
        ? `Order corrected and reactivated with its original receipt. Committed total: ${formatPrice(committedTotal)}.`
        : `Order corrected with its original receipt. Committed total: ${formatPrice(committedTotal)}.`
    );
  }

  function printHistoricalRevision(
    revision: POSAuditRevision,
    format: ReceiptPrintFormat
  ) {
    if (!selectedTransaction) return;
    const snapshot = revision.snapshot;
    const historical = mapHistoryRow(
      snapshot.transaction,
      snapshot.items,
      selectedTransaction.cashierUsername,
      selectedTransaction.cancelledByUsername
    );
    const printIssue =
      a5CatalogIssue ??
      getA5ReceiptDataIssue(historical, products, inventory);
    if (format === "a4-two-copy" && printIssue) {
      showToast(printIssue, "error");
      return;
    }
    setReceipt({
      ...historical,
      revisionNumber: revision.revision_number,
      historicalRevision:
        revision.revision_number !== selectedTransaction.revisionNumber ||
        snapshot.transaction.transaction_status !==
          selectedTransaction.transactionStatus,
    });
    setPrintFormat(format);
    setPrintRequested(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Sales
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
              Transaction History
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              View and manage completed POS transactions.
            </p>
          </div>
        </div>

        {cancellationRecovery.status !== "missing" &&
          cancellationRecovery.status !== "loading" &&
          cancellationRecovery.status !== "auth-unavailable" && (
          <section
            aria-live="polite"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
          >
            <h2 className="font-semibold">Cancellation recovery needed</h2>
            <p className="mt-1 text-sm">
              The previous cancellation may already have committed. Retrying sends the same request ID; if the server retained its idempotency record, it should return the prior result instead of applying cancellation again. Verify transaction history if the outcome remains unclear, and do not start another cancellation until this attempt is resolved.
            </p>
            {cancellationRecovery.status === "valid" && (
              <p className="mt-1 text-xs text-amber-800">
                Transaction {cancellationRecovery.attempt.transactionId} · saved {new Date(cancellationRecovery.attempt.createdAt).toLocaleString()}.
              </p>
            )}
            {cancellationRecovery.status === "expired" && (
              <p className="mt-1 text-xs text-amber-800">
                This saved attempt is older than {POS_RETRY_ATTEMPT_TTL_MS / (60 * 60 * 1000)} hours. Automatic retry is disabled; continue only after reviewing the transaction history.
              </p>
            )}
            {cancellationRecovery.status === "invalid" && (
              <p className="mt-1 text-xs text-amber-800">
                The saved attempt is malformed and cannot be retried. Review the transaction before discarding it.
              </p>
            )}
            {cancellationRecovery.status === "unavailable" && (
              <p className="mt-1 text-xs text-amber-800">
                Session storage could not be read or updated. Recovery persistence cannot be confirmed.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {cancellationRecovery.status === "valid" && (
                <Button
                  type="button"
                  onClick={() => void retryPreviousCancellation()}
                  disabled={isCancelling}
                >
                  {isCancelling ? "Checking..." : "Retry previous cancellation"}
                </Button>
              )}
              {cancellationRecovery.status === "expired" &&
                !confirmExpiredCancellationRetry && (
                <Button
                  type="button"
                  onClick={() => setConfirmExpiredCancellationRetry(true)}
                  disabled={isCancelling}
                >
                  Continue recovery
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmCancellationDiscard(true)}
                disabled={isCancelling}
              >
                Discard pending attempt
              </Button>
            </div>
            {confirmExpiredCancellationRetry &&
              cancellationRecovery.status === "expired" && (
              <div className="mt-3 rounded-lg border border-amber-400 bg-white p-3">
                <p className="text-sm">
                  The server may have committed this cancellation. Continuing sends the exact saved request ID and reason; it cannot undo a completed cancellation.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => void continueExpiredCancellationRecovery()}
                    disabled={isCancelling}
                  >
                    Continue recovery
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmExpiredCancellationRetry(false)}
                    disabled={isCancelling}
                  >
                    Keep pending
                  </Button>
                </div>
              </div>
            )}
            {confirmCancellationDiscard && (
              <div className="mt-3 rounded-lg border border-red-300 bg-white p-3">
                <p className="text-sm text-red-900">
                  Discarding removes only this tab’s retry key. It does not undo a cancellation, and the server may already have committed it. Verify the transaction in history before making another change.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={discardCancellationAttempt}
                    disabled={isCancelling}
                  >
                    Confirm discard
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmCancellationDiscard(false)}
                    disabled={isCancelling}
                  >
                    Keep pending
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {cancellationRecovery.status === "auth-unavailable" && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            The signed-in user could not be verified. Cancellation is disabled until the session can be checked.
          </p>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Transactions
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {summary.totalTransactions}
              </h3>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Sales
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-emerald-700">
                {formatPrice(summary.totalSales)}
              </h3>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Items Sold
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {summary.totalItemsSold}
              </h3>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Average Transaction Value
            </p>
            {loading ? (
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
            ) : (
              <h3 className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {formatPrice(summary.averageValue)}
              </h3>
            )}
          </div>

        </div>

        {/* Filters + Table */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          {/* Filter Toolbar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">

            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-3">

              <Input
                label="Search"
                type="text"
                placeholder="DR number, customer, or phone..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <Select
                label="Date"
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value)
                }
                options={[
                  { label: "All Dates", value: "ALL" },
                  { label: "Today", value: "TODAY" },
                  { label: "Yesterday", value: "YESTERDAY" },
                  { label: "This Week", value: "THIS_WEEK" },
                  { label: "This Month", value: "THIS_MONTH" },
                  { label: "Custom Date Range", value: "CUSTOM" },
                ]}
              />

              <Select
                label="Payment Method"
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(event.target.value)
                }
                options={[
                  { label: "All Payment Methods", value: "ALL" },
                  { label: "Cash", value: "CASH" },
                  { label: "Cheque", value: "CHEQUE" },
                ]}
              />

              <Select
                label="Status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Completed", value: "COMPLETED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
              />

              <Select
                label="Cashier"
                value={cashierFilter}
                onChange={(event) =>
                  setCashierFilter(event.target.value)
                }
                options={cashierOptions}
              />

              <Select
                label="Area"
                value={areaFilter}
                onChange={(event) =>
                  setAreaFilter(event.target.value)
                }
                options={areaOptions}
              />

            </div>

            {dateFilter === "CUSTOM" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Start Date"
                  type="date"
                  value={customStart}
                  onChange={(event) =>
                    setCustomStart(event.target.value)
                  }
                />
                <Input
                  label="End Date"
                  type="date"
                  value={customEnd}
                  onChange={(event) =>
                    setCustomEnd(event.target.value)
                  }
                />
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

              <div className="w-full sm:max-w-xs">
                <Select
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value)
                  }
                  options={[
                    { label: "Newest First", value: "NEWEST" },
                    { label: "Oldest First", value: "OLDEST" },
                    { label: "Highest Amount", value: "AMOUNT_HIGH" },
                    { label: "Lowest Amount", value: "AMOUNT_LOW" },
                    { label: "Highest Quantity", value: "QTY_HIGH" },
                    { label: "Lowest Quantity", value: "QTY_LOW" },
                  ]}
                />
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
                >
                  Clear Filters
                </button>
              )}

            </div>

          </div>

          {/* Table / States */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-dashed border-red-200 bg-red-50 py-12 text-center">
              <p className="text-sm font-medium text-red-700">
                Unable to load transaction history.
              </p>
              <p className="mt-1 text-xs text-red-500">
                {loadError}
              </p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
              <p className="text-sm font-medium text-slate-600">
                No transactions yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Completed sales will appear here.
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
              <p className="text-sm font-medium text-slate-600">
                No transactions match your filters.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try adjusting your search or filters.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[880px] border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date &amp; Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cashier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Items</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Total Items</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 font-semibold text-emerald-700">
                          {transaction.deliveryReceiptNumber}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {new Date(transaction.createdAt).toLocaleString("en-PH")}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-900">
                          {transaction.cashierUsername}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-900">
                          {transaction.customerName || "Walk-in Customer"}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">
                          {getItemsSummary(transaction.items)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm tabular-nums text-slate-600">
                          {getTotalQuantity(transaction.items)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatPrice(transaction.subtotal)}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatPaymentMethod(transaction.paymentMethod)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={
                            transaction.transactionStatus === "CANCELLED"
                              ? "inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200"
                              : "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          }>
                            {transaction.revisionNumber > 1
                              ? `CORRECTED · ${transaction.transactionStatus}`
                              : transaction.transactionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => openDetails(transaction)}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-sm text-slate-500">
                    Showing{" "}
                    {sortedTransactions.length === 0
                      ? 0
                      : (page - 1) * pageSize + 1}
                    –
                    {Math.min(page * pageSize, sortedTransactions.length)}{" "}
                    of {sortedTransactions.length} transactions
                  </p>

                  <div className="w-full max-w-[9rem]">
                    <Select
                      label=""
                      value={String(pageSize)}
                      onChange={(event) =>
                        setPageSize(Number(event.target.value))
                      }
                      options={PAGE_SIZE_OPTIONS.map((size) => ({
                        label: `${size} / page`,
                        value: String(size),
                      }))}
                    />
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {pageNumbers.map((entry, index) =>
                      entry === "..." ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-2 text-sm text-slate-400"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={entry}
                          type="button"
                          onClick={() => setPage(entry)}
                          className={
                            entry === page
                              ? "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                              : "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          }
                        >
                          {entry}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      <Modal
        open={selectedTransaction !== null}
        title={selectedTransaction?.deliveryReceiptNumber ?? "Transaction Details"}
        onClose={closeDetails}
      >
        {selectedTransaction && (
          <div className="space-y-5">

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <span className="text-slate-500">Delivery Receipt</span>
                <span className="text-right font-semibold text-emerald-700">{selectedTransaction.deliveryReceiptNumber}</span>

                <span className="text-slate-500">Revision</span>
                <span className="text-right text-slate-900">
                  {selectedTransaction.revisionNumber}
                  {selectedTransaction.revisionNumber > 1 ? " · Corrected" : " · Original"}
                </span>

                <span className="text-slate-500">Cashier</span>
                <span className="text-right text-slate-900">{selectedTransaction.cashierUsername}</span>

                <span className="text-slate-500">Date &amp; Time</span>
                <span className="text-right text-slate-900">{new Date(selectedTransaction.createdAt).toLocaleString("en-PH")}</span>

                <span className="text-slate-500">Customer</span>
                <span className="text-right text-slate-900">{selectedTransaction.customerName || "Walk-in Customer"}</span>

                <span className="text-slate-500">Address</span>
                <span className="text-right text-slate-900">{selectedTransaction.customerAddress || "-"}</span>

                <span className="text-slate-500">Phone</span>
                <span className="text-right text-slate-900">{selectedTransaction.customerPhone || "-"}</span>
              </div>
            </div>

            {selectedTransaction.transactionStatus === "CANCELLED" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <h3 className="text-sm font-semibold text-red-900">
                  Cancellation Information
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
                  <span className="text-red-700">Cancelled By</span>
                  <span className="text-right text-slate-900">
                    {selectedTransaction.cancelledByUsername}
                  </span>

                  <span className="text-red-700">Cancelled At</span>
                  <span className="text-right text-slate-900">
                    {selectedTransaction.cancelledAt
                      ? new Date(selectedTransaction.cancelledAt).toLocaleString("en-PH")
                      : "-"}
                  </span>

                  <span className="text-red-700">Reason</span>
                  <span className="text-right text-slate-900">
                    {selectedTransaction.cancellationReason || "-"}
                  </span>
                </div>
              </div>
            )}

            {auditLoading && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                Verifying transaction history and IAO-copy status...
              </p>
            )}
            {transactionAudit?.transaction_id === selectedTransaction.id &&
              transactionAudit.copied_to_iao && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  This POS transaction has already been copied to an IAO order. It cannot be cancelled or modified.
                </div>
              )}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Code</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortByProductGroup(
                    selectedTransaction.items,
                    (item) => item.product,
                    products
                  ).map((item) => (
                    <tr key={item.product.id}>
                      <td className="px-3 py-3 font-medium text-slate-900">{item.product.name}</td>
                      <td className="px-3 py-3 text-slate-500">{item.product.code}</td>
                      <td className="px-3 py-3 text-slate-500">{item.product.unit}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatPrice(item.product.price)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatPrice(item.product.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>{formatPrice(selectedTransaction.subtotal)}</strong></div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Checkout Amount Estimate{selectedTransaction.revisionNumber > 1 ? " (unchanged)" : ""}
                </span>
                <strong>{formatPrice(selectedTransaction.amountReceived)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Estimated Change{selectedTransaction.revisionNumber > 1 ? " (unchanged)" : ""}
                </span>
                <strong className="text-emerald-700">{formatPrice(selectedTransaction.changeAmount)}</strong>
              </div>
              <p className="text-xs text-slate-500">
                Checkout estimates only; actual payment is collected upon delivery.
              </p>
              <div className="flex justify-between"><span className="text-slate-500">Payment Method</span><strong>{formatPaymentMethod(selectedTransaction.paymentMethod)}</strong></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">Status</span><strong>{selectedTransaction.transactionStatus}</strong></div>
            </div>

            {transactionAudit?.transaction_id === selectedTransaction.id && (
              <>
                <section className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Saved revisions</h3>
                  <div className="space-y-2">
                    {transactionAudit.revisions.map((revision) => (
                      <div key={revision.revision_number} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                        <div>
                          <strong>Revision {revision.revision_number}</strong>
                          <span className="ml-2 text-slate-500">
                            {new Date(revision.created_at).toLocaleString("en-PH")}
                          </span>
                          {revision.reason && <p className="text-xs text-slate-500">{revision.reason}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              printHistoricalRevision(revision, "thermal")
                            }
                          >
                            Print 80 mm
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={Boolean(a5CatalogIssue)}
                            title={a5CatalogIssue ?? undefined}
                            onClick={() =>
                              printHistoricalRevision(revision, "a4-two-copy")
                            }
                          >
                            Print Two Copies (A4)
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Lifecycle history</h3>
                  <ol className="space-y-2 text-sm">
                    {transactionAudit.events.map((event, index) => (
                      <li key={`${event.event_type}-${event.created_at}-${index}`} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <strong>
                            {event.event_type === "BASELINE"
                              ? "Baseline captured · earlier lifecycle history unavailable"
                              : `${event.event_type} · Revision ${event.revision_number}`}
                          </strong>
                          <span className="text-slate-500">{new Date(event.created_at).toLocaleString("en-PH")}</span>
                        </div>
                        {event.event_type === "BASELINE" && (
                          <p className="mt-1 text-slate-600">
                            This records the transaction state when lifecycle auditing was introduced; it does not assert how or when earlier status changes occurred.
                          </p>
                        )}
                        {event.reason && <p className="mt-1 text-slate-600">{event.reason}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            {(a5CatalogIssue ??
              getA5ReceiptDataIssue(
                selectedTransaction,
                products,
                inventory
              )) && (
              <p className="text-right text-xs text-amber-700">
                {a5CatalogIssue ??
                  getA5ReceiptDataIssue(
                    selectedTransaction,
                    products,
                    inventory
                  )}
              </p>
            )}

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDetails}
              >
                Close
              </Button>

              <Button
                type="button"
                onClick={() =>
                  printTransaction(selectedTransaction, "thermal")
                }
              >
                Print 80 mm Receipt
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(
                  a5CatalogIssue ??
                    getA5ReceiptDataIssue(
                      selectedTransaction,
                      products,
                      inventory
                    )
                )}
                title={
                  a5CatalogIssue ??
                  getA5ReceiptDataIssue(
                    selectedTransaction,
                    products,
                    inventory
                  ) ??
                  undefined
                }
                onClick={() =>
                  printTransaction(selectedTransaction, "a4-two-copy")
                }
              >
                Print Two Delivery Receipt Copies (A4)
              </Button>

              {transactionAudit?.transaction_id === selectedTransaction.id &&
                !transactionAudit.copied_to_iao &&
                selectedTransaction.transactionStatus === "COMPLETED" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void startEditing(selectedTransaction)}
                >
                  Modify Order
                </Button>
              )}

              {transactionAudit?.transaction_id === selectedTransaction.id &&
                !transactionAudit.copied_to_iao &&
                selectedTransaction.transactionStatus === "CANCELLED" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void startEditing(selectedTransaction)}
                >
                  Correct &amp; Reactivate
                </Button>
              )}

              {transactionAudit?.transaction_id === selectedTransaction.id &&
                !transactionAudit.copied_to_iao &&
                selectedTransaction.transactionStatus === "COMPLETED" && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => openCancellation(selectedTransaction)}
                >
                  Cancel Order
                </Button>
              )}

              {auditLoading && (
                <Button type="button" disabled>
                  Checking...
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={cancellationTarget !== null}
        title="Cancel this order?"
        onClose={closeCancellation}
      >
        {cancellationTarget && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Choose to leave this order fully cancelled, or correct it instead. A correction keeps the same transaction and receipt, recalculates current product prices, and adjusts inventory by the net quantity difference.
            </p>

            <Input
              label="Cancellation reason (optional)"
              type="text"
              value={cancellationReason}
              onChange={(event) =>
                setCancellationReason(event.target.value)
              }
              placeholder="Customer requested order changes"
              disabled={isCancelling}
            />

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={closeCancellation}
                disabled={isCancelling}
              >
                Keep Order
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const target = cancellationTarget;
                  closeCancellation();
                  if (target) void startEditing(target);
                }}
                disabled={isCancelling}
              >
                Modify Order Instead
              </Button>

              <Button
                type="button"
                variant="danger"
                onClick={() => void cancelTransaction()}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Cancel Only"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {editingTransaction && (
        <POSOrderEditor
          key={`${editingTransaction.id}:${editingTransaction.revisionNumber}`}
          transaction={editingTransaction}
          inventory={inventory}
          inventorySyncStatus={inventorySyncStatus}
          onClose={() => setEditingTransaction(null)}
          onSaved={(committedTotal, reopened) =>
            void handleModificationSaved(committedTotal, reopened)
          }
        />
      )}

      <DeliveryReceiptPrint receipt={receipt} />
      <A5DeliveryReceiptPrint
        receipt={receipt}
        products={products}
        inventory={inventory}
      />
    </div>
  );
}