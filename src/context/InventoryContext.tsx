import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  Product,
  Transaction,
  Outlet,
} from "../types/inventory";

import { getInventory } from "../utils/inventory";
import { isSameOutletNameAndAddress } from "../utils/outlets";
import { supabase } from "../lib/supabase";

interface InventoryContextType {
  products: Product[];

  transactions: Transaction[];

  outlets: Outlet[];

  inventory: (Product & {
    stock: number;
  })[];

  isLoading: boolean;

  loadError: string | null;

  inventorySyncStatus: "loading" | "refreshing" | "fresh" | "stale" | "error";

  inventoryRealtimeStatus: "connecting" | "subscribed" | "unavailable";

  inventoryLastSyncedAt: number | null;

  inventorySyncError: string | null;

  markInventoryStale: (message?: string) => void;

  loadOperationalData: (
    userId: string
  ) => Promise<void>;

  clearOperationalData: () => void;

  retryOperationalData: () => Promise<void>;

  addProduct: (
    product: Product
  ) => Promise<boolean>;

  updateProduct: (
    product: Product
  ) => Promise<boolean>;

  deleteProduct: (
    id: string
  ) => Promise<boolean>;

  addTransaction: (
    transaction: Transaction
  ) => Promise<boolean>;

  addOutlet: (
    outlet: Omit<
      Outlet,
      "id" | "createdAt" | "updatedAt"
    >
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;

  updateOutlet: (
    outlet: Outlet
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;

  deleteOutlet: (
    id: string
  ) => Promise<boolean>;

  refreshInventory: (options?: { invalidate?: boolean }) => Promise<void>;

  refreshOutlets: () => Promise<void>;
}

const InventoryContext =
  createContext<InventoryContextType | null>(
    null
  );

interface Props {
  children: ReactNode;
}

type LoadResult<T> =
  | { succeeded: true; data: T }
  | { succeeded: false; error: unknown };

interface OperationalDataOperation {
  generation: number;
  userId: string;
}

async function captureLoad<T>(
  load: () => Promise<T>
): Promise<LoadResult<T>> {
  try {
    return {
      succeeded: true,
      data: await load(),
    };
  } catch (error) {
    return {
      succeeded: false,
      error,
    };
  }
}

const TRANSACTION_PAGE_SIZE = 500;

/*
 * Fetch every transaction page by page (Supabase caps rows per request).
 * Throws if any page fails so callers never receive partial history.
 */
async function fetchAllTransactions(): Promise<Transaction[]> {
  const rows: { id: unknown }[] = [];

  for (let from = 0; ; from += TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + TRANSACTION_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < TRANSACTION_PAGE_SIZE) {
      break;
    }
  }

  const uniqueRows = new Map<unknown, { id: unknown }>();
  for (const row of rows) {
    uniqueRows.set(row.id, row);
  }

  return Array.from(uniqueRows.values()).map(mapTransaction);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return String(error);
}

/*
 * Convert Supabase product data
 * from snake_case to frontend camelCase.
 */
function mapProduct(row: any): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: row.price,
    minimumStock: row.minimum_stock,
  };
}

/*
 * Convert Supabase transaction data
 * from snake_case to frontend camelCase.
 */
function mapTransaction(
  row: any
): Transaction {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantity: row.quantity,
    date: row.date,
    remarks: row.remarks ?? "",
    posTransactionId: row.pos_transaction_id ?? null,
    posRevision: row.pos_revision ?? null,
    posEventId: row.pos_event_id ?? null,
  };
}

/*
 * Convert Supabase outlet data
 * from snake_case to frontend camelCase.
 */
function mapOutlet(row: any): Outlet {
  return {
    id: row.id,
    outletName: row.outlet_name,
    contactPerson: row.contact_person,
    degicNumber: row.degic_number ?? "",
    contactNumber: row.contact_number,
    completeAddress: row.complete_address,
    areaCode: row.area_code,
    tin: row.tin ?? "",
    idType: row.id_type ?? "",
    idNumber: row.id_number ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDuplicateOutletMessage() {
  return "An outlet with the same name and address already exists.";
}

function getSupabaseOutletErrorMessage(
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  }
) {
  const code = error?.code ?? "";
  const message =
    error?.message?.toLowerCase() ?? "";

  if (
    code === "23505" ||
    message.includes("duplicate") ||
    message.includes("already exists")
  ) {
    return getDuplicateOutletMessage();
  }

  return (
    error?.message ||
    "This outlet could not be saved. Please review the information and try again."
  );
}

export function InventoryProvider({
  children,
}: Props) {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [activeUserId, setActiveUserId] =
    useState<string | null>(null);

  const [inventorySyncStatus, setInventorySyncStatus] =
    useState<InventoryContextType["inventorySyncStatus"]>("loading");

  const [inventoryRealtimeStatus, setInventoryRealtimeStatus] =
    useState<InventoryContextType["inventoryRealtimeStatus"]>("connecting");

  const [inventoryLastSyncedAt, setInventoryLastSyncedAt] =
    useState<number | null>(null);

  const [inventorySyncError, setInventorySyncError] =
    useState<string | null>(null);

  const [inventoryRefreshPending, setInventoryRefreshPending] =
    useState(false);

  const loadRequestIdRef = useRef(0);
  const operationGenerationRef = useRef(0);
  const inventoryInvalidationVersionRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const attemptedUserIdRef = useRef<string | null>(null);
  const inFlightLoadRef = useRef<{
    userId: string;
    promise: Promise<void>;
  } | null>(null);
  const inFlightInventoryRefreshRef = useRef<{
    promise: Promise<void>;
    rerun: boolean;
  } | null>(null);

  const getOperation = useCallback(
    (): OperationalDataOperation | null => {
      const userId = activeUserIdRef.current;
      if (!userId) {
        return null;
      }

      return {
        generation: operationGenerationRef.current,
        userId,
      };
    },
    []
  );

  const isCurrentOperation = useCallback(
    (operation: OperationalDataOperation | null) =>
      Boolean(
        operation &&
        operation.generation === operationGenerationRef.current &&
        operation.userId === activeUserIdRef.current
      ),
    []
  );

  const clearOperationalData = useCallback(() => {
    loadRequestIdRef.current += 1;
    operationGenerationRef.current += 1;
    activeUserIdRef.current = null;
    setActiveUserId(null);
    attemptedUserIdRef.current = null;
    inFlightLoadRef.current = null;
    inFlightInventoryRefreshRef.current = null;
    inventoryInvalidationVersionRef.current += 1;
    setProducts([]);
    setTransactions([]);
    setOutlets([]);
    setIsLoading(false);
    setLoadError(null);
    setInventorySyncStatus("loading");
    setInventoryRealtimeStatus("connecting");
    setInventoryLastSyncedAt(null);
    setInventorySyncError(null);
    setInventoryRefreshPending(false);
  }, []);

  const loadForUser = useCallback(
    (
      userId: string,
      force: boolean
    ): Promise<void> => {
      if (activeUserIdRef.current !== userId) {
        loadRequestIdRef.current += 1;
        operationGenerationRef.current += 1;
        activeUserIdRef.current = userId;
        setActiveUserId(userId);
        attemptedUserIdRef.current = null;
        inFlightLoadRef.current = null;
        inFlightInventoryRefreshRef.current = null;
        inventoryInvalidationVersionRef.current += 1;
        setProducts([]);
        setTransactions([]);
        setOutlets([]);
        setLoadError(null);
        setInventorySyncStatus("loading");
        setInventoryRealtimeStatus("connecting");
        setInventoryLastSyncedAt(null);
        setInventorySyncError(null);
        setInventoryRefreshPending(false);
      }

      const currentLoad = inFlightLoadRef.current;
      if (currentLoad?.userId === userId) {
        return currentLoad.promise;
      }

      if (!force && attemptedUserIdRef.current === userId) {
        return Promise.resolve();
      }

      attemptedUserIdRef.current = userId;
      operationGenerationRef.current += 1;
      const requestId = ++loadRequestIdRef.current;
      const inventoryVersionAtLoadStart =
        ++inventoryInvalidationVersionRef.current;
      setIsLoading(true);
      setLoadError(null);
      setInventoryRealtimeStatus("connecting");
      setInventorySyncStatus("refreshing");
      setInventorySyncError(null);

      const promise = (async () => {
        const [productResult, transactionResult, outletResult] =
          await Promise.all([
            captureLoad(async () => {
              const { data, error } = await supabase
                .from("products")
                .select("*")
                .order("id");

              if (error) {
                throw error;
              }

              return (data ?? []).map(mapProduct);
            }),
            captureLoad(fetchAllTransactions),
            captureLoad(async () => {
              const { data, error } = await supabase
                .from("outlets")
                .select("*")
                .order("outlet_name", {
                  ascending: true,
                });

              if (error) {
                throw error;
              }

              return (data ?? []).map(mapOutlet);
            }),
          ]);

        if (
          loadRequestIdRef.current !== requestId ||
          activeUserIdRef.current !== userId
        ) {
          return;
        }

        const errors: string[] = [];

        if (!productResult.succeeded) {
          console.error(
            "Error loading products:",
            productResult.error
          );
          errors.push(
            `Products: ${getErrorMessage(productResult.error)}`
          );
        } else {
          setProducts(productResult.data);
        }

        if (!transactionResult.succeeded) {
          console.error(
            "Error loading transactions:",
            transactionResult.error
          );
          errors.push(
            `Transactions: ${getErrorMessage(transactionResult.error)}`
          );
          if (
            inventoryVersionAtLoadStart ===
            inventoryInvalidationVersionRef.current
          ) {
            setInventorySyncStatus("error");
            setInventorySyncError(
              `Unable to refresh inventory: ${getErrorMessage(transactionResult.error)}`
            );
          }
        } else {
          if (
            inventoryVersionAtLoadStart ===
            inventoryInvalidationVersionRef.current
          ) {
            inventoryInvalidationVersionRef.current += 1;
            setTransactions(transactionResult.data);
            setInventoryLastSyncedAt(Date.now());
            setInventorySyncStatus("fresh");
            setInventorySyncError(null);
          } else {
            setInventoryRefreshPending(true);
          }
        }

        if (!outletResult.succeeded) {
          console.error(
            "Error loading outlets:",
            outletResult.error
          );
          errors.push(
            `Outlets: ${getErrorMessage(outletResult.error)}`
          );
        } else {
          setOutlets(outletResult.data);
        }

        setLoadError(
          errors.length > 0
            ? errors.join(" ")
            : null
        );
      })().finally(() => {
        if (
          loadRequestIdRef.current === requestId &&
          activeUserIdRef.current === userId
        ) {
          setIsLoading(false);
          if (inFlightLoadRef.current?.promise === promise) {
            inFlightLoadRef.current = null;
          }
        }
      });

      inFlightLoadRef.current = {
        userId,
        promise,
      };

      return promise;
    },
    []
  );

  const loadOperationalData = useCallback(
    (userId: string) => loadForUser(userId, false),
    [loadForUser]
  );

  const retryOperationalData = useCallback(async () => {
    const operation = {
      generation: operationGenerationRef.current,
      userId: activeUserIdRef.current,
    };
    const isCurrentRetry = () =>
      operation.generation === operationGenerationRef.current &&
      operation.userId === activeUserIdRef.current;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!isCurrentRetry()) {
      return;
    }

    if (sessionError) {
      console.error(
        "Unable to verify session before retrying operational data load:",
        sessionError
      );
      setLoadError(
        `Session verification: ${getErrorMessage(sessionError)}`
      );
      return;
    }

    if (!session) {
      clearOperationalData();
      return;
    }

    if (
      operation.userId &&
      session.user.id !== operation.userId
    ) {
      clearOperationalData();
      return;
    }

    const { data: status, error: statusError } =
      await supabase.rpc("get_current_user_status");

    if (!isCurrentRetry()) {
      return;
    }

    if (statusError) {
      console.error(
        "Unable to verify account status before retrying operational data load:",
        statusError
      );
      clearOperationalData();
      setLoadError(
        `Account status verification: ${getErrorMessage(statusError)}`
      );
      return;
    }

    if (status !== "ACTIVE") {
      clearOperationalData();
      setLoadError(
        "Operational data can only be loaded for an active account."
      );
      return;
    }

    const {
      data: { session: currentSession },
      error: currentSessionError,
    } = await supabase.auth.getSession();

    if (!isCurrentRetry()) {
      return;
    }

    if (currentSessionError) {
      console.error(
        "Unable to recheck session before retrying operational data load:",
        currentSessionError
      );
      setLoadError(
        `Session verification: ${getErrorMessage(currentSessionError)}`
      );
      return;
    }

    if (
      !currentSession ||
      currentSession.user.id !== session.user.id
    ) {
      clearOperationalData();
      return;
    }

    await loadForUser(session.user.id, true);
  }, [
    clearOperationalData,
    loadForUser,
  ]);

  useEffect(
    () => () => {
      loadRequestIdRef.current += 1;
      operationGenerationRef.current += 1;
      activeUserIdRef.current = null;
    },
    []
  );

  /*
   * Load outlets from Supabase.
   */
  async function loadOutlets() {
    const operation = getOperation();
    if (!operation) {
      return;
    }

    const {
      data: outletData,
      error: outletError,
    } = await supabase
      .from("outlets")
      .select("*")
      .order("outlet_name", {
        ascending: true,
      });

    if (outletError) {
      console.error(
        "Error loading outlets:",
        outletError
      );
      return;
    }

    if (!isCurrentOperation(operation)) {
      return;
    }

    setOutlets(
      (outletData ?? []).map(mapOutlet)
    );
  }

  const markInventoryStale = useCallback((message?: string) => {
    inventoryInvalidationVersionRef.current += 1;
    setInventorySyncStatus("stale");
    setInventorySyncError(message ?? null);
    if (inFlightInventoryRefreshRef.current) {
      inFlightInventoryRefreshRef.current.rerun = true;
    }
  }, []);

  const loadTransactions = useCallback(async (options?: {
    invalidate?: boolean;
  }) => {
    if (options?.invalidate) {
      markInventoryStale();
    }

    const operation = getOperation();
    if (!operation) {
      setInventorySyncStatus("error");
      setInventorySyncError("Inventory cannot be refreshed without an active session.");
      return;
    }

    const initialLoad = inFlightLoadRef.current;
    if (initialLoad?.userId === operation.userId) {
      await initialLoad.promise;
      if (!isCurrentOperation(operation)) return;
    }

    const currentRefresh = inFlightInventoryRefreshRef.current;
    if (currentRefresh) {
      return currentRefresh.promise;
    }

    const refreshState = {
      promise: Promise.resolve(),
      rerun: false,
    };
    const promise = (async () => {
      setInventorySyncStatus("refreshing");
      setInventorySyncError(null);

      while (true) {
        refreshState.rerun = false;
        const invalidationVersion =
          inventoryInvalidationVersionRef.current;

        try {
          const loadedTransactions = await fetchAllTransactions();
          if (!isCurrentOperation(operation)) return;

          if (
            invalidationVersion !==
            inventoryInvalidationVersionRef.current
          ) {
            refreshState.rerun = true;
            continue;
          }

          inventoryInvalidationVersionRef.current += 1;
          setTransactions(loadedTransactions);
          setInventoryLastSyncedAt(Date.now());
          setInventorySyncStatus("fresh");
          setInventorySyncError(null);
        } catch (transactionError) {
          if (!isCurrentOperation(operation)) return;

          if (
            invalidationVersion !==
            inventoryInvalidationVersionRef.current
          ) {
            refreshState.rerun = true;
            continue;
          }

          console.error("Error refreshing inventory:", transactionError);
          setInventorySyncStatus("error");
          setInventorySyncError(
            `Unable to refresh inventory: ${getErrorMessage(transactionError)}`
          );
        }

        if (!refreshState.rerun) {
          if (inFlightInventoryRefreshRef.current === refreshState) {
            inFlightInventoryRefreshRef.current = null;
          }
          return;
        }
      }
    })();

    refreshState.promise = promise;
    inFlightInventoryRefreshRef.current = refreshState;
    return promise;
  }, [getOperation, isCurrentOperation, markInventoryStale]);

  useEffect(() => {
    if (!inventoryRefreshPending || isLoading) return;
    const refreshTimer = window.setTimeout(() => {
      setInventoryRefreshPending(false);
      void loadTransactions();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [inventoryRefreshPending, isLoading, loadTransactions]);

  useEffect(() => {
    if (!activeUserId || isLoading) return;

    let active = true;
    let refreshTimer: number | undefined;
    let fallbackTimer: number | undefined;

    const refreshWhenAvailable = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void loadTransactions();
      }
    };

    const markOffline = () => {
      setInventoryRealtimeStatus("unavailable");
      markInventoryStale("The device is offline. Inventory may be outdated.");
    };

    const handleOnline = () => {
      markInventoryStale("Connection restored. Refreshing inventory.");
      void loadTransactions();
    };

    const handleInventoryChange = () => {
      if (!active) return;
      markInventoryStale();
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshWhenAvailable();
      }, 300);
    };

    const startFallbackRefresh = () => {
      if (fallbackTimer !== undefined) return;
      fallbackTimer = window.setInterval(() => {
        refreshWhenAvailable();
      }, 30_000);
    };

    const channel = supabase
      .channel(`inventory-transactions:${activeUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        handleInventoryChange
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setInventoryRealtimeStatus("subscribed");
          markInventoryStale();
          void loadTransactions();
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setInventoryRealtimeStatus("unavailable");
          markInventoryStale(
            "Live inventory updates are unavailable. Checking periodically."
          );
          startFallbackRefresh();
          if (navigator.onLine) {
            void loadTransactions();
          }
        }
      });

    const handleOffline = () => {
      markOffline();
      startFallbackRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshWhenAvailable();
      }
    };

    window.addEventListener("focus", refreshWhenAvailable);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (!navigator.onLine) {
      handleOffline();
    } else {
      startFallbackRefresh();
    }

    return () => {
      active = false;
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      if (fallbackTimer !== undefined) {
        window.clearInterval(fallbackTimer);
      }
      window.removeEventListener("focus", refreshWhenAvailable);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [
    activeUserId,
    isLoading,
    loadTransactions,
    markInventoryStale,
  ]);

  /*
   * Calculate inventory from products
   * and transactions.
   */
  const inventory = useMemo(
    () =>
      getInventory(
        products,
        transactions
      ),
    [products, transactions]
  );

  /*
   * Add product.
   */
  async function addProduct(
    product: Product
  ): Promise<boolean> {
    const operation = getOperation();
    if (!operation) {
      return false;
    }

    const exists = products.some(
      (existingProduct) =>
        existingProduct.code
          .trim()
          .toLowerCase() ===
        product.code
          .trim()
          .toLowerCase()
    );

    if (exists) {
      return false;
    }

    const { data, error } =
      await supabase
        .from("products")
        .insert({
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: product.price,
          minimum_stock:
            product.minimumStock,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Error adding product:",
        error
      );

      return false;
    }

    if (!isCurrentOperation(operation)) {
      return false;
    }

    setProducts((prev) => [
      ...prev,
      mapProduct(data),
    ]);

    return true;
  }

  /*
   * Update product.
   */
  async function updateProduct(
    updatedProduct: Product
  ): Promise<boolean> {
    const operation = getOperation();
    if (!operation) {
      return false;
    }

    const { data, error } =
      await supabase
        .from("products")
        .update({
          code: updatedProduct.code,
          name: updatedProduct.name,
          category:
            updatedProduct.category,
          unit: updatedProduct.unit,
          price: updatedProduct.price,
          minimum_stock:
            updatedProduct.minimumStock,
        })
        .eq(
          "id",
          updatedProduct.id
        )
        .select()
        .single();

    if (error) {
      console.error(
        "Error updating product:",
        error
      );

      return false;
    }

    if (!isCurrentOperation(operation)) {
      return false;
    }

    setProducts((prev) =>
      prev.map((product) =>
        product.id ===
        updatedProduct.id
          ? mapProduct(data)
          : product
      )
    );

    return true;
  }

  /*
   * Delete product.
   */
  async function deleteProduct(
    id: string
  ): Promise<boolean> {
    const operation = getOperation();
    if (!operation) {
      return false;
    }

    const hasTransactions =
      transactions.some(
        (transaction) =>
          transaction.productId === id
      );

    if (hasTransactions) {
      return false;
    }

    const { error } =
      await supabase
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Error deleting product:",
        error
      );

      return false;
    }

    if (!isCurrentOperation(operation)) {
      return false;
    }

    setProducts((prev) =>
      prev.filter(
        (product) =>
          product.id !== id
      )
    );

    return true;
  }

  /*
   * Add outlet.
   */
  async function addOutlet(
    outlet: Omit<
      Outlet,
      "id" | "createdAt" | "updatedAt"
    >
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const operation = getOperation();
    if (!operation) {
      return { success: false };
    }

    const duplicateExists = outlets.some((existingOutlet) =>
      isSameOutletNameAndAddress(existingOutlet, outlet)
    );

    if (duplicateExists) {
      return {
        success: false,
        message: getDuplicateOutletMessage(),
      };
    }

    const { data, error } =
      await supabase
        .from("outlets")
        .insert({
          outlet_name:
            outlet.outletName,
          contact_person:
            outlet.contactPerson,
          degic_number:
            outlet.degicNumber?.trim() || null,
          contact_number:
            outlet.contactNumber,
          complete_address:
            outlet.completeAddress,
          area_code:
            outlet.areaCode,
          tin:
            outlet.tin?.trim() || null,
          id_type:
            outlet.idType?.trim() || null,
          id_number:
            outlet.idNumber?.trim() || null,
          status: outlet.status,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Error adding outlet:",
        JSON.stringify(error, null, 2)
      );

      console.error(
        "Error code:",
        error.code
      );

      console.error(
        "Error message:",
        error.message
      );

      console.error(
        "Error details:",
        error.details
      );

      console.error(
        "Error hint:",
        error.hint
      );

      return {
        success: false,
        message:
          getSupabaseOutletErrorMessage(
            error
          ),
      };
    }

    if (!isCurrentOperation(operation)) {
      return { success: false };
    }

    setOutlets((prev) =>
      [...prev, mapOutlet(data)].sort(
        (a, b) =>
          a.outletName.localeCompare(
            b.outletName
          )
      )
    );

    return {
      success: true,
    };
  }

  /*
   * Update outlet.
   */
  async function updateOutlet(
    updatedOutlet: Outlet
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const operation = getOperation();
    if (!operation) {
      return { success: false };
    }

    const duplicateExists = outlets.some(
      (outlet) =>
        outlet.id !== updatedOutlet.id &&
        isSameOutletNameAndAddress(outlet, updatedOutlet)
    );

    if (duplicateExists) {
      return {
        success: false,
        message: getDuplicateOutletMessage(),
      };
    }

    const { data, error } =
      await supabase
        .from("outlets")
        .update({
          outlet_name:
            updatedOutlet.outletName,
          contact_person:
            updatedOutlet.contactPerson,
          degic_number:
            updatedOutlet.degicNumber?.trim() || null,
          contact_number:
            updatedOutlet.contactNumber,
          complete_address:
            updatedOutlet.completeAddress,
          area_code:
            updatedOutlet.areaCode,
          tin:
            updatedOutlet.tin?.trim() ||
            null,
          id_type:
            updatedOutlet.idType?.trim() ||
            null,
          id_number:
            updatedOutlet.idNumber?.trim() ||
            null,
          status:
            updatedOutlet.status,
        })
        .eq(
          "id",
          updatedOutlet.id
        )
        .select()
        .single();

    if (error) {
      console.error(
        "Error updating outlet:",
        JSON.stringify(error, null, 2)
      );

      console.error(
        "Error code:",
        error.code
      );

      console.error(
        "Error message:",
        error.message
      );

      console.error(
        "Error details:",
        error.details
      );

      console.error(
        "Error hint:",
        error.hint
      );

      return {
        success: false,
        message:
          getSupabaseOutletErrorMessage(
            error
          ),
      };
    }

    if (!isCurrentOperation(operation)) {
      return { success: false };
    }

    setOutlets((prev) =>
      prev
        .map((outlet) =>
          outlet.id === updatedOutlet.id
            ? mapOutlet(data)
            : outlet
        )
        .sort(
          (a, b) =>
            a.outletName.localeCompare(
              b.outletName
            )
        )
    );

    return {
      success: true,
    };
  }

  /*
   * Delete outlet.
   */
  async function deleteOutlet(
    id: string
  ): Promise<boolean> {
    const operation = getOperation();
    if (!operation) {
      return false;
    }

    const { error } =
      await supabase
        .from("outlets")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Error deleting outlet:",
        error
      );

      return false;
    }

    if (!isCurrentOperation(operation)) {
      return false;
    }

    setOutlets((prev) =>
      prev.filter(
        (outlet) =>
          outlet.id !== id
      )
    );

    return true;
  }

  /*
   * Add transaction.
   */
  async function addTransaction(
    transaction: Transaction
  ): Promise<boolean> {
    const operation = getOperation();
    if (!operation) {
      return false;
    }

    const productExists =
      products.some(
        (product) =>
          product.id ===
          transaction.productId
      );

    if (!productExists) {
      return false;
    }

    const rpcName =
      transaction.type === "OUT"
        ? "create_stock_out_transaction"
        : transaction.type === "IN"
          ? "create_stock_in_transaction"
          : "create_stock_adjustment_transaction";

    const rpcArguments =
      transaction.type === "OUT"
        ? {
            p_transaction_id: transaction.id,
            p_product_id: transaction.productId,
            p_quantity: transaction.quantity,
            p_date: transaction.date,
            p_remarks: transaction.remarks ?? "",
          }
        : {
            p_product_id: transaction.productId,
            p_quantity: transaction.quantity,
            p_date: transaction.date,
            p_remarks: transaction.remarks ?? "",
          };

    const { data, error } = await supabase.rpc(
      rpcName,
      rpcArguments
    );

    if (error) {
      console.error(
        "Error adding transaction:",
        error
      );

      return false;
    }

    const row = Array.isArray(data)
      ? data[0]
      : data;

    if (!isCurrentOperation(operation)) {
      return false;
    }

    setTransactions((prev) => [
      ...prev,
      mapTransaction(row),
    ]);
    markInventoryStale();
    void loadTransactions();

    return true;
  }

  return (
    <InventoryContext.Provider
      value={{
        products,
        transactions,
        outlets,
        inventory,
        isLoading,
        loadError,
        inventorySyncStatus,
        inventoryRealtimeStatus,
        inventoryLastSyncedAt,
        inventorySyncError,
        markInventoryStale,
        loadOperationalData,
        clearOperationalData,
        retryOperationalData,

        addProduct,
        updateProduct,
        deleteProduct,
        addTransaction,

        addOutlet,
        updateOutlet,
        deleteOutlet,

        refreshInventory: loadTransactions,

        refreshOutlets:
          loadOutlets,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventoryContext() {
  const context = useContext(
    InventoryContext
  );

  if (!context) {
    throw new Error(
      "useInventoryContext must be used inside InventoryProvider."
    );
  }

  return context;
}