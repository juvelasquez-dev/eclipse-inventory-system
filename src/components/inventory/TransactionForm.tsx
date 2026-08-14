import { useEffect, useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

import { useInventory } from "../../hooks/useInventory";
import { categories } from "../../mock/categories";

type TransactionType =
  | "IN"
  | "OUT"
  | "ADJUSTMENT";

interface TransactionFormProps {
  type: TransactionType;

  onSubmit: (data: {
    productId: string;
    quantity: number;
    remarks: string;
  }) => void;
}

export default function TransactionForm({
  type,
  onSubmit,
}: TransactionFormProps) {
  const {
    products,
    transactions,
  } = useInventory();

  const [category, setCategory] =
    useState("");

  const [flavor, setFlavor] =
    useState("");

  const [productId, setProductId] =
    useState("");

  const [adjustmentType, setAdjustmentType] =
    useState<"ADD" | "REMOVE">("ADD");

  const [quantity, setQuantity] =
    useState(1);

  const [remarks, setRemarks] =
    useState("");

  const [error, setError] =
    useState("");

  /*
   * Get flavors directly from the
   * current product catalog.
   *
   * This allows newly added products
   * to appear automatically.
   */
  const availableFlavors = category
    ? Array.from(
        new Set(
          products
            .filter(
              (product) =>
                product.category === category
            )
            .map((product) => {
              const suffix =
                ` ${category}`;

              return product.name.endsWith(
                suffix
              )
                ? product.name.slice(
                    0,
                    -suffix.length
                  )
                : product.name;
            })
        )
      )
    : [];

  const selectedProduct =
    products.find(
      (product) =>
        product.id === productId
    );

  /*
   * Find the actual product whenever
   * category and flavor are selected.
   */
  useEffect(() => {
    if (!category || !flavor) {
      setProductId("");
      return;
    }

    const product =
      products.find(
        (product) =>
          product.category === category &&
          (
            product.name ===
              `${flavor} ${category}` ||
            product.name === flavor
          )
      );

    setProductId(
      product?.id ?? ""
    );
  }, [
    category,
    flavor,
    products,
  ]);

  /*
   * Calculate the current stock.
   *
   * IN          = add
   * OUT         = subtract
   * ADJUSTMENT  = add/subtract based
   *               on the stored quantity
   */
  function getCurrentStock(
    selectedProductId: string
  ) {
    return transactions
      .filter(
        (transaction) =>
          transaction.productId ===
          selectedProductId
      )
      .reduce(
        (total, transaction) => {
          if (
            transaction.type === "IN"
          ) {
            return (
              total +
              transaction.quantity
            );
          }

          if (
            transaction.type === "OUT"
          ) {
            return (
              total -
              transaction.quantity
            );
          }

          // ADJUSTMENT
          return (
            total +
            transaction.quantity
          );
        },
        0
      );
  }

  const currentStock =
    selectedProduct
      ? getCurrentStock(
          selectedProduct.id
        )
      : 0;

  function handleCategoryChange(
    value: string
  ) {
    setCategory(value);
    setFlavor("");
    setProductId("");
    setError("");
  }

  function handleFlavorChange(
    value: string
  ) {
    setFlavor(value);
    setError("");
  }

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!category) {
      setError(
        "Please select a size."
      );
      return;
    }

    if (!flavor) {
      setError(
        "Please select a flavor."
      );
      return;
    }

    if (!productId) {
      setError(
        "This product is not available in the product catalog."
      );
      return;
    }

    if (quantity <= 0) {
      setError(
        "Quantity must be greater than 0."
      );
      return;
    }

    /*
     * Stock Out validation.
     */
    if (
      type === "OUT" &&
      quantity > currentStock
    ) {
      setError(
        `Insufficient stock. Only ${currentStock} ${
          selectedProduct?.unit ?? ""
        } available.`
      );
      return;
    }

    /*
     * Adjustment removal validation.
     */
    if (
      type === "ADJUSTMENT" &&
      adjustmentType === "REMOVE" &&
      quantity > currentStock
    ) {
      setError(
        `Cannot remove ${quantity} ${
          selectedProduct?.unit ?? ""
        }. Only ${currentStock} ${
          selectedProduct?.unit ?? ""
        } available.`
      );
      return;
    }

    /*
     * Adjustment quantity is stored
     * as positive or negative.
     */
    const finalQuantity =
      type === "ADJUSTMENT" &&
      adjustmentType === "REMOVE"
        ? -quantity
        : quantity;

    setError("");

    onSubmit({
      productId,
      quantity: finalQuantity,
      remarks: remarks.trim(),
    });

    setQuantity(1);
    setRemarks("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Size */}
        <Select
          label="Size"
          value={category}
          onChange={(e) =>
            handleCategoryChange(
              e.target.value
            )
          }
          options={[
            {
              value: "",
              label: "Select Size",
            },
            ...categories.map(
              (category) => ({
                value: category,
                label: category,
              })
            ),
          ]}
        />

        {/* Flavor */}
        <Select
          label="Flavor"
          value={flavor}
          onChange={(e) =>
            handleFlavorChange(
              e.target.value
            )
          }
          disabled={!category}
          options={[
            {
              value: "",
              label: category
                ? "Select Flavor"
                : "Select Size First",
            },
            ...availableFlavors.map(
              (flavor) => ({
                value: flavor,
                label: flavor,
              })
            ),
          ]}
        />

      </div>

      {/* Adjustment Type */}
      {type === "ADJUSTMENT" && (
        <Select
          label="Adjustment"
          value={adjustmentType}
          onChange={(e) =>
            setAdjustmentType(
              e.target.value as
                | "ADD"
                | "REMOVE"
            )
          }
          options={[
            {
              value: "ADD",
              label: "Add Stock",
            },
            {
              value: "REMOVE",
              label: "Remove Stock",
            },
          ]}
        />
      )}

      {/* Selected Product Information */}
      {selectedProduct && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">

          <p className="font-medium text-slate-700">
            {selectedProduct.name}
          </p>

          <p className="text-slate-500">
            Code: {selectedProduct.code}
          </p>

          <p className="text-slate-500">
            Unit: {selectedProduct.unit}
          </p>

          <p className="mt-1 font-semibold text-slate-700">
            Current Stock:{" "}
            {currentStock}{" "}
            {selectedProduct.unit}
          </p>

        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Quantity */}
        <Input
          label="Quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) =>
            setQuantity(
              Number(e.target.value)
            )
          }
        />

        {/* Remarks */}
        <Input
          label="Remarks"
          value={remarks}
          onChange={(e) =>
            setRemarks(
              e.target.value
            )
          }
          placeholder={
            type === "ADJUSTMENT"
              ? "Reason for adjustment"
              : "Optional"
          }
        />

      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

        <Button type="submit">
          {type === "IN"
            ? "Save Stock In"
            : type === "OUT"
              ? "Release Stock"
              : "Save Adjustment"}
        </Button>

      </div>
    </form>
  );
}