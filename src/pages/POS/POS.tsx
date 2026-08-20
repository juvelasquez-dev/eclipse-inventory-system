import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

import { useToast } from "../../context/ToastContext";
import { useInventory } from "../../hooks/useInventory";
import { supabase } from "../../lib/supabase";

import type { Product } from "../../types/inventory";

interface CartItem {
  product: Product;
  quantity: number;
}

interface ReceiptData {
  deliveryReceiptNumber: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  amountReceived: number;
  paymentMethod: string;
  createdAt: string;
  items: CartItem[];
  subtotal: number;
  changeAmount: number;
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

export default function POS() {
  const { products, inventory } = useInventory();
  const { showToast } = useToast();

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

  const [amountReceived, setAmountReceived] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("CASH");

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

  const quantityExceedsStock =
    selectedProductStock > 0 &&
    modalQuantity > selectedProductStock;

  function confirmAddToCart() {
    if (!selectedProduct) {
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

  /*
   * =========================================================
   * CHECKOUT
   * =========================================================
   */

  function openCheckout() {
    if (cart.length === 0) {
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

  const parsedAmountReceived =
    amountReceived.trim() === ""
      ? NaN
      : Number(amountReceived);

  const amountIsSufficient =
    Number.isFinite(
      parsedAmountReceived
    ) &&
    parsedAmountReceived >= subtotal;

  const calculatedChange =
    amountIsSufficient
      ? parsedAmountReceived - subtotal
      : 0;

  /*
   * =========================================================
   * COMPLETE SALE
   * =========================================================
   */

  async function completeSale() {
    if (cart.length === 0) {
      showToast(
        "Add at least one product to the cart.",
        "error"
      );
      return;
    }

    if (isSubmitting) {
      return;
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
      return;
    }

    if (!Number.isFinite(parsedAmountReceived)) {
      showToast(
        "Please enter the amount received.",
        "error"
      );
      return;
    }

    if (
      parsedAmountReceived < subtotal
    ) {
      showToast(
        `Amount received must be at least ${formatPrice(
          subtotal
        )}.`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } =
        await supabase.rpc(
          "create_pos_transaction",
          {
            p_customer_name:
              customerName.trim(),

            p_customer_address:
              customerAddress.trim(),

            p_customer_phone:
              customerPhone.trim(),

            p_amount_received:
              parsedAmountReceived,

            p_payment_method:
              paymentMethod,

            p_items: cart.map(
              (item) => ({
                product_id:
                  item.product.id,

                quantity:
                  item.quantity,
              })
            ),
          }
        );

      if (error) {
        console.error(
          "POS transaction failed:",
          error
        );

        showToast(
          error.message ||
            "Unable to complete the sale.",
          "error"
        );

        return;
      }

      const transactionResult =
        data as {
          display_receipt_number?: string;
          subtotal?: number;
          total_amount?: number;
          amount_received?: number;
          change_amount?: number;
          payment_method?: string;
        } | null;

      const receiptNumber =
        transactionResult
          ?.display_receipt_number;

      if (!receiptNumber) {
        showToast(
          "Sale completed without a receipt number.",
          "error"
        );

        return;
      }

      /*
       * Snapshot the cart BEFORE clearing it.
       */
      const receiptItems = [
        ...cart,
      ];

      const finalSubtotal =
        Number(
          transactionResult?.subtotal
        );

      const finalChange =
        Number(
          transactionResult?.change_amount
        );

      clearCart();

      setCheckoutOpen(false);

      setReceipt({
        deliveryReceiptNumber:
          receiptNumber,

        customerName:
          customerName.trim(),

        customerAddress:
          customerAddress.trim(),

        customerPhone:
          customerPhone.trim(),

        amountReceived:
          Number(
            transactionResult?.amount_received
          ) || parsedAmountReceived,

        paymentMethod:
          transactionResult
            ?.payment_method ||
          paymentMethod,

        createdAt:
          new Date().toISOString(),

        items: receiptItems,

        subtotal:
          Number.isFinite(
            finalSubtotal
          )
            ? finalSubtotal
            : subtotal,

        changeAmount:
          Number.isFinite(
            finalChange
          )
            ? finalChange
            : calculatedChange,
      });

      /*
       * Reset checkout fields for the
       * next transaction.
       */
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
      setAmountReceived("");
      setPaymentMethod("CASH");

      showToast(
        `Sale completed: ${receiptNumber}`
      );
    } catch (error) {
      console.error(
        "Unexpected POS error:",
        error
      );

      showToast(
        "An unexpected error occurred while completing the sale.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /*
   * =========================================================
   * RECEIPT
   * =========================================================
   */

  function closeReceipt() {
    setReceipt(null);
  }

  function printReceipt() {
    window.print();
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

        </div>

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
                  isSubmitting
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

              {/* Customer Details */}

              <div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Customer Details
                </h3>

                <div className="mt-3 space-y-4">

                  <Input
                    label="Customer Name"
                    type="text"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(event) =>
                      setCustomerName(
                        event.target.value
                      )
                    }
                  />

                  <Input
                    label="Address"
                    type="text"
                    placeholder="Enter customer address"
                    value={customerAddress}
                    onChange={(event) =>
                      setCustomerAddress(
                        event.target.value
                      )
                    }
                  />

                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="Enter phone number"
                    value={customerPhone}
                    onChange={(event) =>
                      setCustomerPhone(
                        event.target.value
                      )
                    }
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
                    ]}
                  />

                  <Input
                    label="Amount Received"
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
                    Amount Received
                  </span>

                  <span className="font-semibold text-slate-900">
                    {Number.isFinite(
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
                    Change
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

              </div>

              {amountReceived !==
                "" &&
                !amountIsSufficient && (
                  <p className="text-sm font-medium text-red-600">
                    Amount received must
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
                  Amount Received
                </span>

                <span className="font-semibold text-slate-900">
                  {formatPrice(
                    receipt.amountReceived
                  )}
                </span>

              </div>

              <div className="flex justify-between">

                <span className="text-slate-500">
                  Change
                </span>

                <span className="font-semibold text-emerald-700">
                  {formatPrice(
                    receipt.changeAmount
                  )}
                </span>

              </div>

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
                onClick={
                  printReceipt
                }
              >
                Print Receipt
              </Button>

            </div>

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
              <span>Amount Received</span>
              <strong>
                {formatPrice(receipt.amountReceived)}
              </strong>
            </div>

            <div className="dr-total-row">
              <span>Change</span>
              <strong>
                {formatPrice(receipt.changeAmount)}
              </strong>
            </div>

            <div className="dr-total-row">
              <span>Payment</span>
              <strong>
                {receipt.paymentMethod === "CASH"
                  ? "Cash"
                  : receipt.paymentMethod}
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

    </div>
  );
}