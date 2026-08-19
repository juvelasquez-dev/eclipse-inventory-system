import { useMemo, useState } from "react";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

import { useInventory } from "../hooks/useInventory";

import type { Product } from "../types/inventory";

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POS() {
  const { products } = useInventory();

  const [search, setSearch] = useState("");

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const filteredProducts = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    if (!keyword) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name
          .toLowerCase()
          .includes(keyword) ||
        product.code
          .toLowerCase()
          .includes(keyword) ||
        product.category
          .toLowerCase()
          .includes(keyword)
    );
  }, [products, search]);

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

  function addToCart(product: Product) {
    setCart((currentCart) => {
      const existingItem =
        currentCart.find(
          (item) =>
            item.product.id ===
            product.id
        );

      if (existingItem) {
        return currentCart.map(
          (item) =>
            item.product.id ===
            product.id
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

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
          item.product.id !==
          productId
      )
    );
  }

  function clearCart() {
    setCart([]);
  }

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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          Sales
        </span>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          Point of Sale
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage product distribution
          and sales.
        </p>
      </div>

      {/* POS Layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">

        {/* Products */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Products
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select a product to add it
              to the cart.
            </p>
          </div>

          {/* Search */}
          <div className="mb-5">
            <Input
              label=""
              type="text"
              placeholder="Search product, code, or category..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          {/* Product Grid */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map(
                (product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      addToCart(product)
                    }
                    className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {product.code}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                        {product.unit}
                      </span>

                    </div>

                    <div className="mt-4 flex items-center justify-between">

                      <span className="font-semibold text-emerald-700">
                        {formatPrice(
                          product.price
                        )}
                      </span>

                      <span className="text-xs font-medium text-slate-400 transition group-hover:text-emerald-600">
                        + Add
                      </span>

                    </div>
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
              <p className="text-sm font-medium text-slate-600">
                No products found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try another search.
              </p>
            </div>
          )}

        </section>

        {/* Cart */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-5">

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
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
          <div className="flex-1 space-y-3 p-5">

            {cart.length === 0 ? (
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
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="rounded-xl border border-slate-200 p-4"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {item.product.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {formatPrice(
                          item.product.price
                        )}{" "}
                        /{" "}
                        {item.product.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeFromCart(
                          item.product.id
                        )
                      }
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>

                  </div>

                  <div className="mt-4 flex items-center justify-between">

                    {/* Quantity */}
                    <div className="flex items-center rounded-lg border border-slate-200">

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.quantity - 1
                          )
                        }
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>

                      <span className="min-w-10 border-x border-slate-200 px-3 py-1.5 text-center text-sm font-medium text-slate-900">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.quantity + 1
                          )
                        }
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>

                    </div>

                    {/* Item Total */}
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatPrice(
                        item.product.price *
                          item.quantity
                      )}
                    </span>

                  </div>

                </div>
              ))
            )}

          </div>

          {/* Cart Summary */}
          <div className="border-t border-slate-200 p-5">

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Subtotal</span>

              <span className="font-medium tabular-nums text-slate-900">
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-base font-semibold text-slate-900">
                Total
              </span>

              <span className="text-2xl font-bold tabular-nums text-emerald-700">
                {formatPrice(subtotal)}
              </span>
            </div>

            <Button
              type="button"
              disabled={cart.length === 0}
              className="mt-5 w-full"
            >
              Complete Sale
            </Button>

          </div>

        </section>

      </div>
    </div>
  );
}