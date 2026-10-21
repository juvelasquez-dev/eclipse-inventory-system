import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import CustomerOutletSearch from "../../components/pos/CustomerOutletSearch";
import A5DeliveryReceiptPrint from "../../components/pos/A5DeliveryReceiptPrint";
import type { ReceiptData } from "../../components/pos/DeliveryReceiptPrint";

import { useToast } from "../../context/ToastContext";
import { useInventory } from "../../hooks/useInventory";
import { supabase } from "../../lib/supabase";
import { printReceipt as printReceiptInFormat } from "../../utils/receiptPrinting";
import {
  getA5ReceiptCatalogIssue,
  getA5ReceiptDataIssue,
} from "../../utils/a5DeliveryReceipt";
import {
  canonicalizeCheckoutPayload,
  checkoutRetryStorageKey,
  clearSessionAttempt,
  createRetryAttemptTimestamp,
  parseCheckoutPayload,
  POS_RETRY_ATTEMPT_VERSION,
  POS_RETRY_ATTEMPT_TTL_MS,
  readCheckoutAttempt,
  type CheckoutPayload,
  type CheckoutRetryAttempt,
  type StoredAttemptResult,
  writeSessionAttempt,
} from "../../utils/posRetryRecovery";

import type { Outlet, Product } from "../../types/inventory";

interface CartItem {
  product: Product;
  quantity: number;
}

interface SavedPOSTransactionRow {
  customer_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  subtotal: number | string;
  amount_received: number | string;
  change_amount: number | string;
  payment_method: string | null;
  transaction_status: string | null;
  created_at: string;
}

interface SavedPOSTransactionItemRow {
  product_id: string;
  product_name_snapshot: string;
  product_code_snapshot: string;
  unit_snapshot: string;
  unit_price: number | string;
  quantity: number;
}

async function loadSavedReceiptData(
  transactionId: string,
  products: Product[]
): Promise<Partial<ReceiptData>> {
  const [transactionResult, itemResult] = await Promise.all([
    supabase
      .from("pos_transactions")
      .select(
        "customer_name, customer_address, customer_phone, subtotal, amount_received, change_amount, payment_method, transaction_status, created_at"
      )
      .eq("id", transactionId)
      .maybeSingle(),
    supabase
      .from("pos_transaction_items")
      .select(
        "product_id, product_name_snapshot, product_code_snapshot, unit_snapshot, unit_price, quantity"
      )
      .eq("transaction_id", transactionId),
  ]);

  if (transactionResult.error) {
    throw new Error(
      `Unable to reload the saved POS transaction: ${transactionResult.error.message}`
    );
  }
  if (itemResult.error) {
    throw new Error(
      `Unable to reload the saved POS items: ${itemResult.error.message}`
    );
  }
  const transaction = transactionResult.data as SavedPOSTransactionRow | null;
  const savedItems =
    itemResult.data as SavedPOSTransactionItemRow[] | null;
  if (!transaction || !savedItems || savedItems.length === 0) {
    throw new Error("The saved POS receipt details were not found.");
  }

  const items: CartItem[] = savedItems.map((item) => {
    const catalogProduct = products.find(
      (product) => product.id === item.product_id
    );
    return {
      product: {
        id: item.product_id,
        name: item.product_name_snapshot,
        code: item.product_code_snapshot,
        category: catalogProduct?.category ?? "",
        unit: item.unit_snapshot,
        price: Number(item.unit_price),
        minimumStock: catalogProduct?.minimumStock ?? 0,
      },
      quantity: Number(item.quantity),
    };
  });
  const subtotal = Number(transaction.subtotal);
  const amountReceived = Number(transaction.amount_received);
  const changeAmount = Number(transaction.change_amount);
  if (
    !Number.isFinite(subtotal) ||
    !Number.isFinite(amountReceived) ||
    !Number.isFinite(changeAmount) ||
    items.some(
      (item) =>
        !Number.isFinite(item.product.price) ||
        !Number.isFinite(item.quantity)
    )
  ) {
    throw new Error("The saved POS receipt contains invalid numeric values.");
  }

  return {
    customerName: transaction.customer_name ?? "",
    customerAddress: transaction.customer_address ?? "",
    customerPhone: transaction.customer_phone ?? "",
    createdAt: transaction.created_at,
    items,
    subtotal,
    amountReceived,
    changeAmount,
    paymentMethod: transaction.payment_method ?? "",
    transactionStatus: transaction.transaction_status ?? "",
  };
}

/*
 * =========================================================
 * CATEGORY ORDER
 * =========================================================
 *
 * Largest packaging/category first,
 * smallest packaging/category last.
 */

const categoryOrder = [
  "3.6 Liters",
  "Half Gallon",
  "1.7 Liters",
  "1 Liter",
  "Pint",
  "Big Cup",
  "Medium Cup",
  "Small Cup",
  "Ice Cream in Cone",
  "Special Sticks",
  "Ice Buko",
  "Ice Lolly",
];

type CheckoutRecoveryStatus =
  | StoredAttemptResult<CheckoutRetryAttempt>
  | { status: "loading" | "auth-unavailable" };

export default function POS() {
  const {
    products,
    inventory,
    outlets,
    isLoading: catalogLoading,
    loadError: catalogLoadError,
    inventorySyncStatus,
    inventoryRealtimeStatus,
    inventoryLastSyncedAt,
    inventorySyncError,
    refreshInventory,
  } = useInventory();
  const inventoryIsFresh =
    inventorySyncStatus === "fresh" &&
    inventoryRealtimeStatus !== "connecting";
  const inventoryDisplayStatus =
    inventorySyncStatus === "fresh" &&
    inventoryRealtimeStatus === "connecting"
      ? "stale"
      : inventorySyncStatus;
  const { showToast } = useToast();
  const a5CatalogIssue = getA5ReceiptCatalogIssue(
    products,
    inventory,
    catalogLoading,
    catalogLoadError
  );

  /*
   * =========================================================
   * FILTER STATE
   * =========================================================
   */

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [stockStatus, setStockStatus] =
    useState("ALL");

  /*
   * =========================================================
   * CART STATE
   * =========================================================
   */

  const [cart, setCart] =
    useState<CartItem[]>([]);

  /*
   * =========================================================
   * CHECKOUT STATE
   * =========================================================
   */

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [checkoutOpen, setCheckoutOpen] =
    useState(false);

  const [customerName, setCustomerName] =
    useState("");

  const [customerAddress, setCustomerAddress] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [selectedOutlet, setSelectedOutlet] =
    useState<Outlet | null>(null);

  const [amountReceived, setAmountReceived] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("CASH");
  const [saleAreaCode, setSaleAreaCode] =
    useState("");
  const [checkoutUserId, setCheckoutUserId] =
    useState<string | null>(null);
  const checkoutUserIdRef = useRef<string | null>(null);
  const checkoutAuthEventVersion = useRef(0);
  const [checkoutRecovery, setCheckoutRecovery] =
    useState<CheckoutRecoveryStatus>({ status: "loading" });
  const [confirmCheckoutDiscard, setConfirmCheckoutDiscard] =
    useState(false);
  const [confirmExpiredCheckoutRetry, setConfirmExpiredCheckoutRetry] =
    useState(false);
  const checkoutSubmissionLock = useRef(false);

  /*
   * =========================================================
   * ADD TO CART MODAL
   * =========================================================
   */

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [modalQuantity, setModalQuantity] =
    useState(1);

  /*
   * =========================================================
   * RECEIPT STATE
   * =========================================================
   */

  const [receipt, setReceipt] =
    useState<ReceiptData | null>(null);
  const a5PrintIssue = a5CatalogIssue ??
    (receipt ? getA5ReceiptDataIssue(receipt, products, inventory) : null);

  useEffect(() => {
    let active = true;
    async function loadAssignedArea() {
      const { data, error } = await supabase.rpc(
        "get_current_user_area_code"
      );
      if (!active) return;
      if (error) {
        console.error("Unable to load the default POS area:", error);
        return;
      }
      if (data === "IAO" || data === "CBR" || data === "EFT") {
        setSaleAreaCode(data);
      }
    }
    void loadAssignedArea();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        checkoutAuthEventVersion.current += 1;
        checkoutUserIdRef.current = session?.user.id ?? null;
        if (!session?.user) {
          setCheckoutUserId(null);
          setCheckoutRecovery({ status: "auth-unavailable" });
          return;
        }
        setCheckoutUserId(session.user.id);
        setCheckoutRecovery(readCheckoutAttempt(session.user.id));
      }
    );
    async function loadCheckoutRecovery() {
      const authEventVersion = checkoutAuthEventVersion.current;
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (!active) return;
        if (authEventVersion !== checkoutAuthEventVersion.current) return;
        if (error || !user) {
          checkoutUserIdRef.current = null;
          setCheckoutRecovery({ status: "auth-unavailable" });
          return;
        }

        checkoutUserIdRef.current = user.id;
        setCheckoutUserId(user.id);
        setCheckoutRecovery(readCheckoutAttempt(user.id));
      } catch {
        if (active && authEventVersion === checkoutAuthEventVersion.current) {
          checkoutUserIdRef.current = null;
          setCheckoutRecovery({ status: "auth-unavailable" });
        }
      }
    }

    void loadCheckoutRecovery();
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  /*
   * =========================================================
   * CATEGORY OPTIONS
   * =========================================================
   */

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.category)
          .filter(Boolean)
      )
    ).sort((a, b) => {
      const aIndex =
        categoryOrder.indexOf(a);

      const bIndex =
        categoryOrder.indexOf(b);

      const safeA =
        aIndex === -1
          ? categoryOrder.length
          : aIndex;

      const safeB =
        bIndex === -1
          ? categoryOrder.length
          : bIndex;

      return safeA - safeB;
    });
  }, [products]);

  /*
   * =========================================================
   * UNIT OPTIONS
   * =========================================================
   */

  const unitOptions = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.unit)
          .filter(Boolean)
      )
    ).sort();
  }, [products]);

  const inventoryByProductId = useMemo(() => {
    return new Map(
      inventory.map((product) => [
        product.id,
        product,
      ])
    );
  }, [inventory]);

  /*
   * =========================================================
   * FILTER PRODUCTS
   * =========================================================
   */

  const filteredProducts = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    const filtered = products.filter(
      (product) => {
        const matchesSearch =
          !keyword ||
          product.name
            .toLowerCase()
            .includes(keyword) ||
          product.code
            .toLowerCase()
            .includes(keyword) ||
          product.category
            .toLowerCase()
            .includes(keyword);

        const matchesCategory =
          !category ||
          product.category === category;

        const matchesUnit =
          !unit ||
          product.unit === unit;

        const currentStock =
          inventoryByProductId.get(
            product.id
          )?.stock ?? 0;

        const minimumStock =
          product.minimumStock;

        const matchesStockStatus =
          stockStatus === "ALL" ||
          (stockStatus === "IN_STOCK" &&
            currentStock > minimumStock) ||
          (stockStatus === "LOW_STOCK" &&
            currentStock > 0 &&
            currentStock <= minimumStock) ||
          (stockStatus === "OUT_OF_STOCK" &&
            currentStock <= 0);

        return (
          matchesSearch &&
          matchesCategory &&
          matchesUnit &&
          matchesStockStatus
        );
      }
    );

    /*
     * Display products using the same
     * largest-to-smallest category order.
     */
    return [...filtered].sort((a, b) => {
      const aIndex =
        categoryOrder.indexOf(
          a.category
        );

      const bIndex =
        categoryOrder.indexOf(
          b.category
        );

      const safeA =
        aIndex === -1
          ? categoryOrder.length
          : aIndex;

      const safeB =
        bIndex === -1
          ? categoryOrder.length
          : bIndex;

      if (safeA !== safeB) {
        return safeA - safeB;
      }

      return a.name.localeCompare(
        b.name
      );
    });
  }, [
    products,
    search,
    category,
    unit,
    stockStatus,
    inventoryByProductId,
  ]);

  /*
   * =========================================================
   * SORT CART
   * =========================================================
   */

  const sortedCart = useMemo(() => {
    return [...cart].sort((a, b) => {
      const aIndex =
        categoryOrder.indexOf(
          a.product.category
        );

      const bIndex =
        categoryOrder.indexOf(
          b.product.category
        );

      const safeA =
        aIndex === -1
          ? categoryOrder.length
          : aIndex;

      const safeB =
        bIndex === -1
          ? categoryOrder.length
          : bIndex;

      if (safeA !== safeB) {
        return safeA - safeB;
      }

      return a.product.name.localeCompare(
        b.product.name
      );
    });
  }, [cart]);

  /*
   * =========================================================
   * FILTER HELPERS
   * =========================================================
   */

  const hasFilters =
    search.trim() !== "" ||
    category !== "" ||
    unit !== "" ||
    stockStatus !== "ALL";

  function clearFilters() {
    setSearch("");
    setCategory("");
    setUnit("");
    setStockStatus("ALL");
  }

  /*
   * =========================================================
   * ADD TO CART MODAL
   * =========================================================
   */

  function openAddToCartModal(
    product: Product
  ) {
    setSelectedProduct(product);
    setModalQuantity(1);
  }

  function closeAddToCartModal() {
    setSelectedProduct(null);
    setModalQuantity(1);
  }

  const selectedProductStock =
    selectedProduct
      ? inventoryByProductId.get(
          selectedProduct.id
        )?.stock ?? 0
      : 0;

  const selectedProductUnit =
    selectedProduct?.unit ?? "unit";

  const selectedProductCartQuantity =
    selectedProduct
      ? cart.find((item) => item.product.id === selectedProduct.id)?.quantity ?? 0
      : 0;

  const quantityExceedsStock =
    selectedProductStock > 0 &&
    selectedProductCartQuantity + modalQuantity > selectedProductStock;

  function confirmAddToCart() {
    if (!selectedProduct) {
      return;
    }

    if (!inventoryIsFresh) {
      showToast("Refresh inventory before adding products to the sale.", "error");
      return;
    }

    if (
      !Number.isInteger(modalQuantity) ||
      modalQuantity < 1 ||
      selectedProductStock <= 0 ||
      quantityExceedsStock
    ) {
      if (quantityExceedsStock) {
        showToast(
          `Only ${selectedProductStock} ${selectedProductUnit} available.`,
          "error"
        );
      }
      return;
    }

    setCart((currentCart) => {
      const existingItem =
        currentCart.find(
          (item) =>
            item.product.id ===
            selectedProduct.id
        );

      if (existingItem) {
        return currentCart.map(
          (item) =>
            item.product.id ===
            selectedProduct.id
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    modalQuantity,
                }
              : item
        );
      }

      return [
        ...currentCart,
        {
          product: selectedProduct,
          quantity: modalQuantity,
        },
      ];
    });

    closeAddToCartModal();
  }

  /*
   * =========================================================
   * CART FUNCTIONS
   * =========================================================
   */

  function updateQuantity(
    productId: string,
    quantity: number
  ) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const currentQuantity =
      cart.find((item) => item.product.id === productId)?.quantity ?? 0;
    const availableStock =
      inventoryByProductId.get(productId)?.stock ?? 0;

    if (
      !inventoryIsFresh &&
      quantity > currentQuantity
    ) {
      showToast("Refresh inventory before increasing cart quantities.", "error");
      return;
    }

    if (
      inventoryIsFresh &&
      (!Number.isInteger(quantity) || quantity > availableStock)
    ) {
      showToast(
        `Only ${availableStock} ${
          cart.find((item) => item.product.id === productId)?.product.unit ?? "unit"
        } available.`,
        "error"
      );
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  }

  function removeFromCart(
    productId: string
  ) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          item.product.id !== productId
      )
    );
  }

  function clearCart() {
    setCart([]);
  }

  /*
   * =========================================================
   * TOTALS
   * =========================================================
   */

  const subtotal = cart.reduce(
    (total, item) =>
      total +
      item.product.price *
        item.quantity,
    0
  );

  const totalItems = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  const cartStockIssues = cart.filter((item) => {
    const availableStock =
      inventoryByProductId.get(item.product.id)?.stock ?? 0;
    return item.quantity > availableStock;
  });

  /*
   * =========================================================
   * CHECKOUT
   * =========================================================
   */

  function openCheckout() {
    if (cart.length === 0) {
      return;
    }
    if (!inventoryIsFresh) {
      showToast("Refresh inventory before starting a checkout.", "error");
      return;
    }
    if (cartStockIssues.length > 0) {
      showToast("Reduce cart quantities to the currently available stock before checkout.", "error");
      return;
    }
    if (checkoutRecovery.status !== "missing") {
      showToast(
        "Resolve the saved checkout attempt before opening a new checkout.",
        "error"
      );
      return;
    }

    setAmountReceived("");
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    if (isSubmitting) {
      return;
    }

    setCheckoutOpen(false);
  }

  function handleSelectOutlet(outlet: Outlet) {
    setSelectedOutlet(outlet);
    setCustomerName(outlet.outletName);
    setCustomerAddress(outlet.completeAddress);
    setCustomerPhone(outlet.contactNumber);
  }

  function handleClearOutlet() {
    setSelectedOutlet(null);
  }

  function formatPaymentMethod(method: string) {
    if (method === "CASH") return "Cash";
    if (method === "CHEQUE") return "Cheque";
    return method;
  }

  const isCheque = paymentMethod === "CHEQUE";

  const parsedAmountReceived =
    amountReceived.trim() === ""
      ? NaN
      : Number(amountReceived);

  const effectiveAmountReceived =
    isCheque ? subtotal : parsedAmountReceived;

  const amountIsSufficient =
    isCheque ||
    (Number.isFinite(parsedAmountReceived) &&
      parsedAmountReceived >= subtotal);

  const calculatedChange =
    isCheque
      ? 0
      : amountIsSufficient
        ? parsedAmountReceived - subtotal
        : 0;

  /*
   * =========================================================
   * COMPLETE SALE
   * =========================================================
   */

  async function completeSale() {
    if (checkoutSubmissionLock.current || isSubmitting) return;
    if (checkoutRecovery.status === "loading") {
      showToast("Checkout recovery is still loading. Please wait.", "error");
      return;
    }
    if (
      checkoutRecovery.status === "auth-unavailable" ||
      !checkoutUserId ||
      checkoutUserId !== checkoutUserIdRef.current
    ) {
      showToast("Unable to verify this session for safe checkout recovery.", "error");
      return;
    }
    if (checkoutRecovery.status !== "missing") {
      showToast(
        "Resolve the pending checkout attempt before starting another sale. Retry it or explicitly discard it first.",
        "error"
      );
      return;
    }

    const payload = getCurrentCheckoutPayload();
    if (!payload) return;
    const attempt: CheckoutRetryAttempt = {
      version: POS_RETRY_ATTEMPT_VERSION,
      requestId: crypto.randomUUID(),
      userId: checkoutUserId,
      createdAt: createRetryAttemptTimestamp(),
      canonicalPayload: canonicalizeCheckoutPayload(payload),
    };
    const storageKey = checkoutRetryStorageKey(checkoutUserId);
    if (!writeSessionAttempt(storageKey, attempt)) {
      setCheckoutRecovery({ status: "unavailable" });
      showToast(
        "Session storage is unavailable. The checkout was not sent because reload-safe recovery cannot be guaranteed.",
        "error"
      );
      return;
    }

    setCheckoutRecovery({ status: "valid", attempt });
    await submitCheckoutAttempt(attempt, payload, false);
  }

  function getCurrentCheckoutPayload(): CheckoutPayload | null {
    if (!inventoryIsFresh) {
      showToast("Refresh inventory before starting a checkout.", "error");
      return null;
    }

    if (cartStockIssues.length > 0) {
      showToast("Reduce cart quantities to the currently available stock before checkout.", "error");
      return null;
    }

    if (cart.length === 0) {
      showToast(
        "Add at least one product to the cart.",
        "error"
      );
      return null;
    }

    if (
      !customerName.trim() ||
      !customerAddress.trim() ||
      !customerPhone.trim()
    ) {
      showToast(
        "Please complete the customer details.",
        "error"
      );
      return null;
    }

    const areaCode = saleAreaCode.trim().toUpperCase();
    if (areaCode !== "IAO" && areaCode !== "CBR" && areaCode !== "EFT") {
      showToast("Select a POS area for this receipt.", "error");
      return null;
    }

    if (!isCheque) {
      if (!Number.isFinite(parsedAmountReceived)) {
        showToast(
          "Please enter a checkout amount estimate.",
          "error"
        );
        return null;
      }

      if (parsedAmountReceived < subtotal) {
        showToast(
          `Checkout amount estimate must be at least ${formatPrice(
            subtotal
          )}.`,
          "error"
        );
        return null;
      }
    }

    const items = Array.from(
      cart.reduce((items, item) => {
        items.set(
          item.product.id,
          (items.get(item.product.id) ?? 0) + item.quantity
        );
        return items;
      }, new Map<string, number>())
    )
      .map(([product_id, quantity]) => ({ product_id, quantity }))
      .sort((left, right) => left.product_id.localeCompare(right.product_id));
    const normalizedPaymentMethod = paymentMethod.trim().toUpperCase();
    if (normalizedPaymentMethod !== "CASH" && normalizedPaymentMethod !== "CHEQUE") {
      showToast("Select a valid payment method.", "error");
      return null;
    }
    const checkoutPayload: CheckoutPayload = {
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim(),
      customer_phone: customerPhone.trim(),
      amount_received:
        Math.round(effectiveAmountReceived * 100) / 100,
      payment_method: normalizedPaymentMethod,
      area_code: areaCode,
      items,
    };
    if (
      !Number.isFinite(checkoutPayload.amount_received) ||
      checkoutPayload.amount_received < 0
    ) {
      showToast("Enter a valid checkout amount estimate.", "error");
      return null;
    }
    return checkoutPayload;
  }

  async function retryCheckoutAttempt() {
    if (
      checkoutSubmissionLock.current ||
      checkoutRecovery.status !== "valid" ||
      checkoutRecovery.attempt.userId !== checkoutUserId ||
      checkoutRecovery.attempt.userId !== checkoutUserIdRef.current
    ) {
      return;
    }
    const latestAttempt = readCheckoutAttempt(checkoutUserId);
    setCheckoutRecovery(latestAttempt);
    if (latestAttempt.status !== "valid") return;
    const payload = parseCheckoutPayload(latestAttempt.attempt.canonicalPayload);
    if (!payload) {
      setCheckoutRecovery({ status: "invalid" });
      showToast("The saved checkout attempt is invalid and cannot be retried.", "error");
      return;
    }
    await submitCheckoutAttempt(latestAttempt.attempt, payload, true);
  }

  async function continueExpiredCheckoutRecovery() {
    if (
      checkoutSubmissionLock.current ||
      checkoutRecovery.status !== "expired" ||
      checkoutRecovery.attempt.userId !== checkoutUserId ||
      checkoutRecovery.attempt.userId !== checkoutUserIdRef.current
    ) {
      return;
    }
    const latestAttempt = readCheckoutAttempt(checkoutUserId);
    setCheckoutRecovery(latestAttempt);
    if (latestAttempt.status !== "expired") return;
    const payload = parseCheckoutPayload(latestAttempt.attempt.canonicalPayload);
    if (!payload) {
      setCheckoutRecovery({ status: "invalid" });
      return;
    }
    setConfirmExpiredCheckoutRetry(false);
    await submitCheckoutAttempt(latestAttempt.attempt, payload, true);
  }

  async function submitCheckoutAttempt(
    attempt: CheckoutRetryAttempt,
    payload: CheckoutPayload,
    isRecovery: boolean
  ) {
    if (
      checkoutSubmissionLock.current ||
      isSubmitting ||
      !checkoutUserId ||
      attempt.userId !== checkoutUserIdRef.current ||
      attempt.userId !== checkoutUserId
    ) return;
    checkoutSubmissionLock.current = true;
    setIsSubmitting(true);

    try {
      const { data, error } =
        await supabase.rpc(
          "create_pos_transaction_for_area",
          {
            p_customer_name: payload.customer_name,
            p_customer_address: payload.customer_address,
            p_customer_phone: payload.customer_phone,
            p_amount_received: payload.amount_received,
            p_payment_method: payload.payment_method,
            p_items: payload.items,
            p_area_code: payload.area_code,
            p_request_id: attempt.requestId,
          }
        );

      if (error) {
        setCheckoutOpen(false);
        void refreshInventory({ invalidate: true });
        console.error("POS transaction failed:", error);
        showToast(
          error.message ||
            "Unable to complete the sale.",
          "error"
        );

        return;
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("transaction_id" in data) ||
        !("display_receipt_number" in data) ||
        !("subtotal" in data) ||
        !("amount_received" in data) ||
        !("change_amount" in data) ||
        !("payment_method" in data) ||
        !("transaction_status" in data) ||
        typeof data.transaction_id !== "string" ||
        data.transaction_id.length === 0 ||
        typeof data.display_receipt_number !== "string" ||
        data.display_receipt_number.length === 0 ||
        typeof data.subtotal !== "number" ||
        !Number.isFinite(data.subtotal) ||
        typeof data.amount_received !== "number" ||
        !Number.isFinite(data.amount_received) ||
        typeof data.change_amount !== "number" ||
        !Number.isFinite(data.change_amount) ||
        typeof data.payment_method !== "string" ||
        data.transaction_status !== "COMPLETED"
      ) {
        setCheckoutOpen(false);
        void refreshInventory({ invalidate: true });
        showToast(
          "The checkout may have completed, but its confirmation was incomplete. Retrying sends the same request ID; the server can return the earlier result only if it retained the idempotency record. Check POS History before discarding this attempt.",
          "error"
        );
        return;
      }
      const transactionResult = data;
      const receiptNumber = transactionResult.display_receipt_number;
      void refreshInventory({ invalidate: true });
      const cleared = clearSessionAttempt(
        checkoutRetryStorageKey(attempt.userId)
      );
      if (checkoutUserIdRef.current !== attempt.userId) return;
      if (cleared) {
        setCheckoutRecovery({ status: "missing" });
        setConfirmCheckoutDiscard(false);
      }

      if (isRecovery) {
        if (cleared) {
          const currentItems = Array.from(
            cart.reduce((items, item) => {
              items.set(
                item.product.id,
                (items.get(item.product.id) ?? 0) + item.quantity
              );
              return items;
            }, new Map<string, number>())
          )
            .map(([product_id, quantity]) => ({ product_id, quantity }))
            .sort((left, right) =>
              left.product_id.localeCompare(right.product_id)
            );
          const currentPaymentMethod = paymentMethod.trim().toUpperCase();
          const currentAreaCode = saleAreaCode.trim().toUpperCase();
          const currentAmountReceived =
            currentPaymentMethod === "CHEQUE"
              ? subtotal
              : Number(amountReceived);
          if (
            currentItems.length > 0 &&
            JSON.stringify(currentItems) === JSON.stringify(payload.items) &&
            customerName.trim() === payload.customer_name &&
            customerAddress.trim() === payload.customer_address &&
            customerPhone.trim() === payload.customer_phone &&
            currentPaymentMethod === payload.payment_method &&
            currentAreaCode === payload.area_code &&
            Number.isFinite(currentAmountReceived) &&
            Math.round(currentAmountReceived * 100) / 100 ===
              payload.amount_received
          ) {
            clearCart();
            setCustomerName("");
            setCustomerAddress("");
            setCustomerPhone("");
            setSelectedOutlet(null);
            setAmountReceived("");
            setPaymentMethod("CASH");
          }
          showToast(
            `Checkout confirmed: ${receiptNumber}. The receipt is available in POS History.`
          );
        } else {
          showToast(
            `Checkout confirmed: ${receiptNumber}. The retry record could not be cleared; retry it again before starting another sale.`,
            "error"
          );
        }
        return;
      }

      /*
       * Snapshot the cart BEFORE clearing it.
       */
      const receiptItems = [
        ...cart,
      ];
      let savedReceiptData: Partial<ReceiptData> = {};
      let savedReceiptIssue: string | null = null;
      try {
        savedReceiptData = await loadSavedReceiptData(
          transactionResult.transaction_id,
          products
        );
      } catch (error) {
        console.error("Unable to reload completed POS receipt data:", error);
        savedReceiptIssue =
          "Saved receipt details could not be reloaded. Use POS History to print the A5 receipt.";
      }

      clearCart();

      setCheckoutOpen(false);

      setReceipt({
        customerName:
          customerName.trim(),

        customerAddress:
          customerAddress.trim(),

        customerPhone:
          customerPhone.trim(),

        amountReceived: transactionResult.amount_received,

        paymentMethod: transactionResult.payment_method,

        createdAt:
          new Date().toISOString(),

        items: savedReceiptData.items ?? receiptItems,

        subtotal: savedReceiptData.subtotal ?? transactionResult.subtotal,

        changeAmount:
          savedReceiptData.changeAmount ?? transactionResult.change_amount,
        ...savedReceiptData,
        deliveryReceiptNumber: receiptNumber,
        a5PrintIssue: savedReceiptIssue,
      });

      /*
       * Reset checkout fields for the
       * next transaction.
       */
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
      setSelectedOutlet(null);
      setAmountReceived("");
      setPaymentMethod("CASH");

      showToast(
        savedReceiptIssue
          ? `Sale completed: ${receiptNumber}. POS History has the saved details for A5 printing.`
          : `Sale completed: ${receiptNumber}`
      );
    } catch (error) {
      setCheckoutOpen(false);
      void refreshInventory({ invalidate: true });
      console.error("Unexpected POS error:", error);
      showToast(
        "Checkout confirmation is uncertain. The saved attempt is retained; retry it before starting another sale.",
        "error"
      );
    } finally {
      checkoutSubmissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  function discardCheckoutAttempt() {
    if (
      checkoutSubmissionLock.current ||
      !checkoutUserId ||
      checkoutUserId !== checkoutUserIdRef.current
    ) return;
    if (!clearSessionAttempt(checkoutRetryStorageKey(checkoutUserId))) {
      setCheckoutRecovery({ status: "unavailable" });
      showToast("Unable to remove the saved checkout attempt from this tab.", "error");
      return;
    }
    setCheckoutRecovery({ status: "missing" });
    setConfirmCheckoutDiscard(false);
    setConfirmExpiredCheckoutRetry(false);
  }

  /*
   * =========================================================
   * RECEIPT
   * =========================================================
   */

  function closeReceipt() {
    setReceipt(null);
  }

  function printReceipt(format: "thermal" | "a4-two-copy") {
    try {
      printReceiptInFormat(format);
    } catch (error) {
      console.error(`Unable to open the ${format} receipt print dialog:`, error);
      showToast("The print dialog could not be opened. The completed sale is unchanged.", "error");
    }
  }

  /*
   * =========================================================
   * PRICE FORMAT
   * =========================================================
   */

  function formatPrice(
    price: number
  ) {
    return `₱${price.toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative">

            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Sales
            </span>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
              Point of Sale
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Manage product distribution
              and sales.
            </p>

          </div>

          {(!inventoryIsFresh ||
            inventoryRealtimeStatus === "unavailable") && (
            <section
              role={inventoryDisplayStatus === "refreshing" || inventoryDisplayStatus === "loading" ? "status" : "alert"}
              aria-live="polite"
              className={`rounded-xl border p-4 ${
                inventoryDisplayStatus === "refreshing" || inventoryDisplayStatus === "loading"
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-amber-300 bg-amber-50 text-amber-950"
              }`}
            >
              <p className="font-semibold">
                {inventoryDisplayStatus === "loading" && "Loading current inventory"}
                {inventoryDisplayStatus === "refreshing" && "Refreshing current inventory"}
                {inventoryDisplayStatus === "stale" && "Inventory may be out of date"}
                {inventoryDisplayStatus === "error" && "Unable to verify current inventory"}
                {inventoryIsFresh &&
                  inventoryRealtimeStatus === "unavailable" &&
                  "Live inventory updates unavailable"}
              </p>
              <p className="mt-1 text-sm">
                {inventorySyncError ??
                  (inventoryIsFresh && inventoryRealtimeStatus === "unavailable"
                    ? "The app is reconciling stock with the database every 30 seconds while this tab is visible and online."
                    : inventoryDisplayStatus === "refreshing" || inventoryDisplayStatus === "loading"
                    ? "Product additions and new checkouts are paused until stock refresh completes."
                    : "Displayed quantities may be outdated. Product additions and new checkouts are paused.")}
                {inventoryLastSyncedAt !== null &&
                  ` Last successful refresh: ${new Date(inventoryLastSyncedAt).toLocaleTimeString("en-PH")}.`}
              </p>
              {(inventoryDisplayStatus === "stale" ||
                inventoryDisplayStatus === "error" ||
                inventoryRealtimeStatus === "unavailable") && (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => void refreshInventory()}
                >
                  Refresh inventory
                </Button>
              )}
            </section>
          )}

        </div>

        {checkoutRecovery.status !== "missing" &&
          checkoutRecovery.status !== "loading" &&
          checkoutRecovery.status !== "auth-unavailable" && (
          <section
            aria-live="polite"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
          >
            <h2 className="font-semibold">Checkout recovery needed</h2>
            <p className="mt-1 text-sm">
              The previous checkout may already have committed. Do not start another sale until you retry the saved request or explicitly discard it.
            </p>
            {checkoutRecovery.status === "valid" && (
              <p className="mt-1 text-xs text-amber-800">
                Saved attempt created {new Date(checkoutRecovery.attempt.createdAt).toLocaleString()}.
              </p>
            )}
            {checkoutRecovery.status === "expired" && (
              <p className="mt-1 text-xs text-amber-800">
                This saved attempt is older than {POS_RETRY_ATTEMPT_TTL_MS / (60 * 60 * 1000)} hours. Retrying is an explicit recovery action; automatic retry is disabled.
              </p>
            )}
            {checkoutRecovery.status === "invalid" && (
              <p className="mt-1 text-xs text-amber-800">
                The saved attempt is malformed and cannot be retried. Check POS History before discarding it.
              </p>
            )}
            {checkoutRecovery.status === "unavailable" && (
              <p className="mt-1 text-xs text-amber-800">
                Session storage could not be read or updated. Safe retry persistence cannot be confirmed.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {checkoutRecovery.status === "valid" && (
                <Button
                  type="button"
                  onClick={() => void retryCheckoutAttempt()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Checking..." : "Retry previous checkout"}
                </Button>
              )}
              {checkoutRecovery.status === "expired" && !confirmExpiredCheckoutRetry && (
                <Button
                  type="button"
                  onClick={() => setConfirmExpiredCheckoutRetry(true)}
                  disabled={isSubmitting}
                >
                  Continue recovery
                </Button>
              )}
              {(checkoutRecovery.status === "valid" ||
                checkoutRecovery.status === "expired") && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmCheckoutDiscard(true)}
                  disabled={isSubmitting}
                >
                  Discard pending attempt
                </Button>
              )}
              {(checkoutRecovery.status === "invalid" ||
                checkoutRecovery.status === "unavailable") && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmCheckoutDiscard(true)}
                  disabled={isSubmitting}
                >
                  Discard pending attempt
                </Button>
              )}
            </div>
            {confirmExpiredCheckoutRetry && checkoutRecovery.status === "expired" && (
              <div className="mt-3 rounded-lg border border-amber-400 bg-white p-3">
                <p className="text-sm">
                  Retrying will send the exact saved request ID and payload. The server may return the earlier result if it committed and retained the request record.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => void continueExpiredCheckoutRecovery()}
                    disabled={isSubmitting}
                  >
                    Continue recovery
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmExpiredCheckoutRetry(false)}
                    disabled={isSubmitting}
                  >
                    Keep pending
                  </Button>
                </div>
              </div>
            )}
            {confirmCheckoutDiscard && (
              <div className="mt-3 rounded-lg border border-red-300 bg-white p-3">
                <p className="text-sm text-red-900">
                  Discarding removes this tab’s retry key only. It does not cancel or undo a server transaction, and the earlier checkout may already exist. Check POS History before starting another sale.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={discardCheckoutAttempt}
                    disabled={isSubmitting}
                  >
                    Confirm discard
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmCheckoutDiscard(false)}
                    disabled={isSubmitting}
                  >
                    Keep pending
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {checkoutRecovery.status === "auth-unavailable" && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            The signed-in user could not be verified. Checkout is disabled until the session can be checked.
          </p>
        )}

        {/* ===================================================
            POS LAYOUT
        =================================================== */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">

          {/* =================================================
              PRODUCTS
          ================================================= */}

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Products
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select a product to add
                  it to the cart.
                </p>
                {inventoryLastSyncedAt !== null &&
                  inventoryIsFresh && (
                    <p className="mt-1 text-xs text-slate-400">
                      Stock last refreshed {new Date(inventoryLastSyncedAt).toLocaleTimeString("en-PH")}.
                    </p>
                  )}

              </div>

              <p className="text-xs font-medium text-slate-400">
                {filteredProducts.length}{" "}
                {filteredProducts.length ===
                1
                  ? "product"
                  : "products"}
              </p>

            </div>

            {/* Filters */}

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">

              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">

                <Input
                  label="Search"
                  type="text"
                  placeholder="Product, code, or category..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />

                <Select
                  label="Category"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  options={[
                    {
                      label:
                        "All Categories",
                      value: "",
                    },

                    ...categoryOptions.map(
                      (item) => ({
                        label: item,
                        value: item,
                      })
                    ),
                  ]}
                />

                <Select
                  label="Unit"
                  value={unit}
                  onChange={(event) =>
                    setUnit(
                      event.target.value
                    )
                  }
                  options={[
                    {
                      label:
                        "All Units",
                      value: "",
                    },

                    ...unitOptions.map(
                      (item) => ({
                        label: item,
                        value: item,
                      })
                    ),
                  ]}
                />

                <Select
                  label="Stock Status"
                  value={stockStatus}
                  onChange={(event) =>
                    setStockStatus(
                      event.target.value
                    )
                  }
                  options={[
                    {
                      label: "All Stock",
                      value: "ALL",
                    },
                    {
                      label: "In Stock",
                      value: "IN_STOCK",
                    },
                    {
                      label: "Low Stock",
                      value: "LOW_STOCK",
                    },
                    {
                      label: "Out of Stock",
                      value: "OUT_OF_STOCK",
                    },
                  ]}
                />

              </div>

              {hasFilters && (
                <div className="mt-3 flex justify-end">

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
                  >
                    Clear Filters
                  </button>

                </div>
              )}

            </div>

            {/* Product Scroll Area */}

            <div className="mt-5 max-h-[calc(100vh-25rem)] overflow-y-auto pr-1">

              {filteredProducts.length >
              0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                  {filteredProducts.map(
                    (product) => {
                      const currentStock =
                        inventoryByProductId.get(
                          product.id
                        )?.stock ?? 0;

                      const stockClass =
                        currentStock <= 0
                          ? "text-red-600"
                          : currentStock <=
                              product.minimumStock
                            ? "text-amber-600"
                            : "text-emerald-600";

                      return (
                      <button
                        key={
                          product.id
                        }
                        type="button"
                        disabled={!inventoryIsFresh}
                        onClick={() =>
                          openAddToCartModal(
                            product
                          )
                        }
                        className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div className="min-w-0">

                            <p className="truncate font-semibold text-slate-900">
                              {
                                product.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                product.code
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-400">
                              {
                                product.category
                              }
                            </p>

                          </div>

                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                            {
                              product.unit
                            }
                          </span>

                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">

                          <span className="text-base font-bold tabular-nums text-emerald-700">
                            {formatPrice(
                              product.price
                            )}
                          </span>

                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
                            + Add
                          </span>

                        </div>

                        <p
                          className={`mt-2 text-xs font-semibold ${stockClass}`}
                        >
                          {currentStock <= 0
                            ? "Out of Stock"
                            : currentStock <=
                                product.minimumStock
                              ? `${currentStock} ${product.unit} available · Low Stock`
                              : `${currentStock} ${product.unit} available`}
                        </p>

                      </button>
                      );
                    }
                  )}

                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">

                  <p className="text-sm font-medium text-slate-600">
                    No products found.
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Try adjusting your
                    filters.
                  </p>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={
                        clearFilters
                      }
                      className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Clear Filters
                    </button>
                  )}

                </div>
              )}

            </div>

          </section>

          {/* =================================================
              CART
          ================================================= */}

          <section className="flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">

            {/* Cart Header */}

            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 p-5">

              <div>

                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Current Sale
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {totalItems}{" "}
                  {totalItems === 1
                    ? "item"
                    : "items"}
                </p>

              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-medium text-red-500 transition hover:text-red-700"
                >
                  Clear Cart
                </button>
              )}

            </div>

            {/* Cart Items */}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">

              {sortedCart.length ===
              0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center">

                  <div>

                    <p className="text-sm font-medium text-slate-600">
                      Your cart is empty
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Select a product to
                      get started.
                    </p>

                  </div>

                </div>
              ) : (
                sortedCart.map(
                  (item) => (
                    <div
                      key={
                        item.product.id
                      }
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="truncate font-medium text-slate-900">
                            {
                              item.product
                                .name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {formatPrice(
                              item.product
                                .price
                            )}{" "}
                            /{" "}
                            {
                              item.product
                                .unit
                            }
                          </p>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.product
                                .id
                            )
                          }
                          className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>

                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">

                        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product
                                  .id,
                                item.quantity -
                                  1
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                          >
                            −
                          </button>

                          <span className="flex h-8 min-w-9 items-center justify-center border-x border-slate-200 text-sm font-semibold tabular-nums text-slate-900">
                            {
                              item.quantity
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.product
                                  .id,
                                item.quantity +
                                  1
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                          >
                            +
                          </button>

                        </div>

                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatPrice(
                            item.product
                              .price *
                              item.quantity
                          )}
                        </span>

                      </div>

                    </div>
                  )
                )
              )}

              {cartStockIssues.length > 0 && (
                <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Some cart quantities are above the displayed available stock. Reduce or remove those items before checkout.
                </p>
              )}

            </div>

            {/* Cart Summary */}

            <div className="border-t border-slate-200 bg-slate-50/60 p-5">

              <div className="flex items-center justify-between text-sm text-slate-500">

                <span>
                  Subtotal
                </span>

                <span className="font-medium tabular-nums text-slate-900">
                  {formatPrice(
                    subtotal
                  )}
                </span>

              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">

                <span className="text-base font-semibold text-slate-900">
                  Total
                </span>

                <span className="text-2xl font-bold tabular-nums text-emerald-700">
                  {formatPrice(
                    subtotal
                  )}
                </span>

              </div>

              <Button
                type="button"
                onClick={openCheckout}
                disabled={
                  cart.length === 0 ||
                  isSubmitting ||
                  !inventoryIsFresh ||
                  cartStockIssues.length > 0
                }
                className="mt-5 w-full !py-3 text-base"
              >
                Complete Sale
              </Button>

            </div>

          </section>

        </div>

      </div>

      {/* =====================================================
          ADD TO CART MODAL
      ===================================================== */}

      {selectedProduct && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAddToCartModal();
            }
          }}
        >

          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Add to Sale
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {
                    selectedProduct.name
                  }
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {
                    selectedProduct.code
                  }{" "}
                  ·{" "}
                  {
                    selectedProduct.unit
                  }
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeAddToCartModal
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>

            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">

              <div className="flex items-center justify-between">

                <span className="text-sm text-slate-500">
                  Unit Price
                </span>

                <span className="font-semibold text-emerald-700">
                  {formatPrice(
                    selectedProduct.price
                  )}
                </span>

              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">

                <span className="text-sm text-slate-500">
                  Available
                </span>

                <span
                  className={`font-semibold ${
                    selectedProductStock <= 0
                      ? "text-red-600"
                      : selectedProductStock <=
                          selectedProduct.minimumStock
                        ? "text-amber-600"
                        : "text-emerald-700"
                  }`}
                >
                  {selectedProductStock <= 0
                    ? "Out of Stock"
                    : `${selectedProductStock} ${selectedProduct.unit}`}
                </span>

              </div>

            </div>

            <div className="mt-6">

              <label
                htmlFor="modal-quantity"
                className="block text-sm font-medium text-slate-700"
              >
                Quantity
              </label>

              <div className="mt-2 flex items-center rounded-xl border border-slate-200">

                <button
                  type="button"
                  onClick={() =>
                    setModalQuantity(
                      (quantity) =>
                        Math.max(
                          1,
                          quantity - 1
                        )
                    )
                  }
                  className="flex h-12 w-12 items-center justify-center text-xl text-slate-600 hover:bg-slate-50"
                >
                  −
                </button>

                <input
                  id="modal-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={modalQuantity}
                  onChange={(event) => {
                    const value =
                      Number(
                        event.target.value
                      );

                    setModalQuantity(
                      Number.isFinite(
                        value
                      )
                        ? Math.max(
                            1,
                            Math.floor(
                              value
                            )
                          )
                        : 1
                    );
                  }}
                  className="h-12 min-w-0 flex-1 border-x border-slate-200 bg-white text-center text-lg font-semibold outline-none"
                />

                <button
                  type="button"
                  onClick={() =>
                    setModalQuantity(
                      (quantity) =>
                        quantity + 1
                    )
                  }
                  className="flex h-12 w-12 items-center justify-center text-xl text-slate-600 hover:bg-slate-50"
                >
                  +
                </button>

              </div>

            </div>

            {selectedProductStock <= 0 && (
              <p className="mt-3 text-sm font-medium text-red-600">
                This product is out of stock.
              </p>
            )}

            {quantityExceedsStock && (
              <p className="mt-3 text-sm font-medium text-red-600">
                Only {selectedProductStock} {selectedProduct.unit} available.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">

              <span className="text-sm font-medium text-emerald-700">
                Line Total
              </span>

              <span className="text-lg font-bold text-emerald-700">
                {formatPrice(
                  selectedProduct.price *
                    modalQuantity
                )}
              </span>

            </div>

            <div className="mt-6 flex justify-end gap-3">

              <Button
                type="button"
                variant="secondary"
                onClick={
                  closeAddToCartModal
                }
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={
                  confirmAddToCart
                }
                disabled={
                  selectedProductStock <= 0 ||
                  quantityExceedsStock ||
                  !inventoryIsFresh ||
                  !Number.isInteger(modalQuantity) ||
                  modalQuantity < 1
                }
              >
                Add to Sale
              </Button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          CHECKOUT MODAL
      ===================================================== */}

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCheckout();
            }
          }}
        >

          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

            {/* Header */}

            <div className="border-b border-slate-200 px-6 py-5">

              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Checkout
              </p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Complete Sale
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter the delivery receipt
                details below.
              </p>

            </div>

            <div className="space-y-5 p-6">

              <Select
                label="Receipt area"
                value={saleAreaCode}
                onChange={(event) => setSaleAreaCode(event.target.value)}
                disabled={isSubmitting}
                options={[
                  { label: "Select POS area", value: "" },
                  { label: "IAO", value: "IAO" },
                  { label: "CBR", value: "CBR" },
                  { label: "EFT", value: "EFT" },
                ]}
              />

              {/* Customer Details */}

              <div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Customer Details
                </h3>

                <div className="mt-3">
                  <CustomerOutletSearch
                    outlets={outlets}
                    customerName={customerName}
                    customerAddress={customerAddress}
                    customerPhone={customerPhone}
                    selectedOutlet={selectedOutlet}
                    onSelectOutlet={handleSelectOutlet}
                    onClearOutlet={handleClearOutlet}
                    onCustomerNameChange={setCustomerName}
                    onCustomerAddressChange={setCustomerAddress}
                    onCustomerPhoneChange={setCustomerPhone}
                    disabled={isSubmitting}
                  />
                </div>

              </div>

              {/* Payment */}

              <div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Payment
                </h3>

                <div className="mt-3 space-y-4">

                  <Select
                    label="Payment Method"
                    value={
                      paymentMethod
                    }
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value
                      )
                    }
                    options={[
                      {
                        label: "Cash",
                        value: "CASH",
                      },
                      {
                        label: "Cheque",
                        value: "CHEQUE",
                      },
                    ]}
                  />

                  {!isCheque && (
                    <Input
                      label="Checkout Amount Estimate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={
                        amountReceived
                      }
                      onChange={(event) =>
                        setAmountReceived(
                          event.target.value
                        )
                      }
                    />
                  )}

                </div>

              </div>

              {/* Summary */}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                <div className="flex justify-between text-sm">

                  <span className="text-slate-500">
                    Total
                  </span>

                  <span className="font-semibold text-slate-900">
                    {formatPrice(
                      subtotal
                    )}
                  </span>

                </div>

                <div className="mt-3 flex justify-between text-sm">

                  <span className="text-slate-500">
                    Checkout Amount Estimate
                  </span>

                  <span className="font-semibold text-slate-900">
                    {isCheque
                      ? formatPrice(subtotal)
                      : Number.isFinite(
                          parsedAmountReceived
                        )
                        ? formatPrice(
                            parsedAmountReceived
                          )
                        : formatPrice(0)}
                  </span>

                </div>

                <div className="mt-3 flex justify-between border-t border-slate-200 pt-3">

                  <span className="font-medium text-slate-700">
                    Estimated Change
                  </span>

                  <span
                    className={`font-bold ${
                      amountIsSufficient
                        ? "text-emerald-700"
                        : "text-slate-400"
                    }`}
                  >
                    {formatPrice(
                      calculatedChange
                    )}
                  </span>

                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Estimates only. Actual payment is collected upon delivery.
                </p>

              </div>

              {!isCheque &&
                amountReceived !==
                "" &&
                !amountIsSufficient && (
                  <p className="text-sm font-medium text-red-600">
                    Checkout amount estimate must
                    be at least{" "}
                    {formatPrice(
                      subtotal
                    )}
                    .
                  </p>
                )}

              {/* Actions */}

              <div className="flex justify-end gap-3 pt-1">

                <Button
                  type="button"
                  variant="secondary"
                  onClick={
                    closeCheckout
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={
                    completeSale
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  {isSubmitting
                    ? "Completing Sale..."
                    : "Complete Sale"}
                </Button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          RECEIPT MODAL
      ===================================================== */}

      {receipt && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeReceipt();
            }
          }}
        >

          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">

            <div className="text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">
                E
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-900">
                Eclipse Food Trading OPC
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Delivery Receipt
              </p>

              <p className="mt-3 text-2xl font-bold text-slate-900">
                {
                  receipt.deliveryReceiptNumber
                }
              </p>

            </div>

            <div className="my-6 border-t border-slate-200" />

            <div className="space-y-2 text-sm">

              <div className="flex justify-between gap-4">

                <span className="text-slate-500">
                  Customer
                </span>

                <span className="text-right font-medium text-slate-900">
                  {
                    receipt.customerName
                  }
                </span>

              </div>

              <div className="flex justify-between gap-4">

                <span className="text-slate-500">
                  Address
                </span>

                <span className="text-right font-medium text-slate-900">
                  {
                    receipt.customerAddress
                  }
                </span>

              </div>

              <div className="flex justify-between gap-4">

                <span className="text-slate-500">
                  Phone
                </span>

                <span className="text-right font-medium text-slate-900">
                  {
                    receipt.customerPhone
                  }
                </span>

              </div>

            </div>

            <div className="my-5 border-t border-slate-200" />

            <div className="space-y-3">

              {receipt.items.map(
                (item) => (
                  <div
                    key={
                      item.product.id
                    }
                    className="flex items-start justify-between gap-4"
                  >

                    <div className="min-w-0">

                      <p className="font-medium text-slate-900">
                        {
                          item.product
                            .name
                        }
                      </p>

                      <p className="text-xs text-slate-400">
                        {
                          item.product
                            .code
                        }{" "}
                        ·{" "}
                        {
                          item.quantity
                        }{" "}
                        ×{" "}
                        {formatPrice(
                          item.product
                            .price
                        )}
                      </p>

                    </div>

                    <span className="shrink-0 font-semibold text-slate-900">
                      {formatPrice(
                        item.product
                          .price *
                          item.quantity
                      )}
                    </span>

                  </div>
                )
              )}

            </div>

            <div className="my-5 border-t border-slate-200" />

            <div className="space-y-2 text-sm">

              <div className="flex justify-between">

                <span className="text-slate-500">
                  Subtotal
                </span>

                <span className="font-semibold text-slate-900">
                  {formatPrice(
                    receipt.subtotal
                  )}
                </span>

              </div>

              <div className="flex justify-between">

                <span className="text-slate-500">
                  Checkout Amount Estimate
                </span>

                <span className="font-semibold text-slate-900">
                  {formatPrice(
                    receipt.amountReceived
                  )}
                </span>

              </div>

              <div className="flex justify-between">

                <span className="text-slate-500">
                  Estimated Change
                </span>

                <span className="font-semibold text-emerald-700">
                  {formatPrice(
                    receipt.changeAmount
                  )}
                </span>

              </div>

              <p className="text-xs text-slate-500">
                Estimates only. Actual payment is collected upon delivery.
              </p>

              <div className="flex justify-between">

                <span className="text-slate-500">
                  Payment
                </span>

                <span className="font-semibold text-slate-900">
                  {
                    receipt.paymentMethod
                  }
                </span>

              </div>

            </div>

            <div className="my-5 border-t-2 border-slate-900" />

            <div className="flex items-center justify-between">

              <span className="text-xl font-bold text-slate-900">
                TOTAL
              </span>

              <span className="text-2xl font-bold text-slate-900">
                {formatPrice(
                  receipt.subtotal
                )}
              </span>

            </div>

            <div className="mt-7 flex justify-end gap-3">

              <Button
                type="button"
                variant="secondary"
                onClick={
                  closeReceipt
                }
              >
                Done
              </Button>

              <Button
                type="button"
                onClick={() => printReceipt("thermal")}
              >
                Print 80 mm Receipt
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(a5PrintIssue)}
                title={a5PrintIssue ?? undefined}
                onClick={() => printReceipt("a4-two-copy")}
              >
                Print Two Delivery Receipt Copies (A4)
              </Button>

            </div>

            {a5PrintIssue && (
              <p className="mt-3 text-right text-xs text-amber-700">
                {a5PrintIssue}
              </p>
            )}

          </div>

        </div>
      )}

            {/* =====================================================
          THERMAL PRINT RECEIPT
      ===================================================== */}

      {receipt && typeof document !== "undefined" && createPortal(
        <div className="dr-receipt">

          {/* Company Header */}
          <div className="dr-header">
            <p className="dr-brand">ECLIPSE</p>
            <p className="dr-company">Eclipse Food Trading OPC</p>
            <p className="dr-address">Caballero Compound Lower Balulang</p>
            <p className="dr-address">Cagayan De Oro City</p>
            <p className="dr-phone">09100000000</p>
          </div>

          <div className="dr-divider" />

          {/* Document Title */}
          <div className="dr-doc">
            <p className="dr-doc-title">DELIVERY RECEIPT</p>
            <p className="dr-doc-number">
              {receipt.deliveryReceiptNumber}
            </p>
          </div>

          <div className="dr-divider" />

          {/* Transaction Details */}
          <div className="dr-info">
            <div className="dr-info-row">
              <span>Date</span>
              <strong>
                {new Date(receipt.createdAt).toLocaleDateString(
                  "en-PH",
                  { month: "short", day: "2-digit", year: "numeric" }
                )}
              </strong>
            </div>

            <div className="dr-info-row">
              <span>Time</span>
              <strong>
                {new Date(receipt.createdAt).toLocaleTimeString(
                  "en-PH",
                  { hour: "2-digit", minute: "2-digit" }
                )}
              </strong>
            </div>

            <div className="dr-info-row">
              <span>Customer</span>
              <strong>{receipt.customerName}</strong>
            </div>

            <div className="dr-info-row">
              <span>Address</span>
              <strong className="dr-wrap">
                {receipt.customerAddress}
              </strong>
            </div>

            <div className="dr-info-row">
              <span>Phone</span>
              <strong>{receipt.customerPhone}</strong>
            </div>
          </div>

          <div className="dr-divider" />

          {/* Items */}
          <div className="dr-items">
            <div className="dr-items-head">
              <span className="dr-col-item">ITEM</span>
              <span className="dr-col-qty">QTY</span>
              <span className="dr-col-price">PRICE</span>
              <span className="dr-col-amount">AMOUNT</span>
            </div>

            {receipt.items.map((item) => {
              const lineTotal =
                item.product.price * item.quantity;

              return (
                <div
                  key={item.product.id}
                  className="dr-item-row"
                >
                  <div className="dr-col-item">
                    <strong>{item.product.name}</strong>
                    <span className="dr-item-code">
                      {item.product.code}
                    </span>
                  </div>

                  <span className="dr-col-qty">
                    {item.quantity}
                  </span>

                  <span className="dr-col-price">
                    {formatPrice(item.product.price)}
                  </span>

                  <strong className="dr-col-amount">
                    {formatPrice(lineTotal)}
                  </strong>
                </div>
              );
            })}
          </div>

          <div className="dr-divider" />

          {/* Totals */}
          <div className="dr-totals">
            <div className="dr-total-row">
              <span>Subtotal</span>
              <strong>{formatPrice(receipt.subtotal)}</strong>
            </div>

            <div className="dr-total-row">
              <span>Checkout Amount Estimate</span>
              <strong>
                {formatPrice(receipt.amountReceived)}
              </strong>
            </div>

            <div className="dr-total-row">
              <span>Estimated Change</span>
              <strong>
                {formatPrice(receipt.changeAmount)}
              </strong>
            </div>

            <p className="text-xs text-slate-500">
              Estimates only. Actual payment is collected upon delivery.
            </p>

            <div className="dr-total-row">
              <span>Payment</span>
              <strong>
                {formatPaymentMethod(receipt.paymentMethod)}
              </strong>
            </div>
          </div>

          <div className="dr-divider dr-divider--thick" />

          {/* Grand Total */}
          <div className="dr-grand-total">
            <span>TOTAL</span>
            <strong>{formatPrice(receipt.subtotal)}</strong>
          </div>

          <div className="dr-divider" />

          {/* Footer */}
          <div className="dr-footer">
            <p>Thank you for your business!</p>
            <p>This document serves as your delivery receipt.</p>
            <p>Items are COMPLETE and in GOOD CONDITION</p>
            <p className="dr-footer-number">
              {receipt.deliveryReceiptNumber}
            </p>
          </div>

        </div>,
        document.body
      )}

      <A5DeliveryReceiptPrint
        receipt={receipt}
        products={products}
        inventory={inventory}
      />

    </div>
  );
}