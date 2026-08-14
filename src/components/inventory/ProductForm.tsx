import { useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

import { categories } from "../../mock/categories";
import { flavorsByCategory } from "../../mock/flavors";
import { generateProductCode } from "../../utils/productCode";

import {
  loadCustomFlavors,
  saveCustomFlavors,
} from "../../utils/storage";

import type { Product } from "../../types/inventory";

const categoryUnits: Record<string, string> = {
  "3.6 Liters": "Tub",
  "Half Gallon": "Tub",
  "1.7 Liters": "Tub",
  "1 Liter": "Tub",
  Pint: "Tub",

  "Big Cup": "Bag",
  "Medium Cup": "Bag",
  "Small Cup": "Bag",

  "Ice Cream in Cone": "Box",

  "Special Sticks": "Bag",
  "Ice Buko": "Bag",
  "Ice Lolly": "Bag",
};

export interface ProductFormData {
  code: string;
  name: string;
  category: string;
  unit: string;
  minimumStock: number;
}

interface ProductFormProps {
  initialValues?: Product;
  onSubmit: (data: ProductFormData) => void;
}

export default function ProductForm({
  initialValues,
  onSubmit,
}: ProductFormProps) {
  const [category, setCategory] = useState(
    initialValues?.category ?? ""
  );

  const [flavor, setFlavor] = useState(() => {
    if (!initialValues?.name) {
      return "";
    }

    const categoryName = initialValues.category;
    const suffix = ` ${categoryName}`;

    if (initialValues.name.endsWith(suffix)) {
      return initialValues.name.slice(
        0,
        -suffix.length
      );
    }

    return initialValues.name;
  });

  const [isNewFlavor, setIsNewFlavor] =
    useState(false);

  const [minimumStock, setMinimumStock] =
    useState(
      initialValues?.minimumStock ?? 0
    );

  const [customFlavors, setCustomFlavors] =
    useState<Record<string, string[]>>(() =>
      loadCustomFlavors()
    );

  const [error, setError] = useState("");

  const unit = categoryUnits[category] ?? "";

  const defaultFlavors =
    flavorsByCategory[
      category as keyof typeof flavorsByCategory
    ] ?? [];

  const customCategoryFlavors =
    customFlavors[category] ?? [];

  const availableFlavors = Array.from(
    new Set([
      ...defaultFlavors,
      ...customCategoryFlavors,
    ])
  );

  const productName =
    flavor && category
      ? `${flavor.trim()} ${category}`
      : "";

  const generatedCode =
    category && flavor.trim()
      ? generateProductCode(
          category,
          flavor.trim()
        )
      : "";

  function handleCategoryChange(
    value: string
  ) {
    setCategory(value);
    setFlavor("");
    setIsNewFlavor(false);
    setError("");
  }

  function handleFlavorChange(
    value: string
  ) {
    if (value === "__NEW_FLAVOR__") {
      setIsNewFlavor(true);
      setFlavor("");
    } else {
      setIsNewFlavor(false);
      setFlavor(value);
    }

    setError("");
  }

  function handleNewFlavorChange(
    value: string
  ) {
    setFlavor(value);
    setError("");
  }

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const cleanFlavor = flavor.trim();

    if (!category) {
      setError("Category is required.");
      return;
    }

    if (!cleanFlavor) {
      setError("Flavor is required.");
      return;
    }

    if (!unit) {
      setError(
        "Unit could not be determined."
      );
      return;
    }

    if (!generatedCode) {
      setError(
        "Product code could not be generated."
      );
      return;
    }

    if (minimumStock < 0) {
      setError(
        "Minimum stock cannot be negative."
      );
      return;
    }

    /*
     * If this is a new flavor, save it to
     * custom flavor storage.
     *
     * We don't modify flavors.ts.
     */
    if (isNewFlavor) {
      const existingFlavors =
        customFlavors[category] ?? [];

      const alreadyExists = Array.from(
        new Set([
          ...defaultFlavors,
          ...existingFlavors,
        ])
      ).some(
        (existingFlavor) =>
          existingFlavor.toLowerCase() ===
          cleanFlavor.toLowerCase()
      );

      if (alreadyExists) {
        setError(
          "This flavor already exists for this category."
        );
        return;
      }

      const updatedCustomFlavors = {
        ...customFlavors,
        [category]: [
          ...existingFlavors,
          cleanFlavor,
        ],
      };

      saveCustomFlavors(
        updatedCustomFlavors
      );

      setCustomFlavors(
        updatedCustomFlavors
      );
    }

    setError("");

    onSubmit({
      code: generatedCode,
      name: `${cleanFlavor} ${category}`,
      category,
      unit,
      minimumStock,
    });
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
        {/* Category */}
        <Select
          label="Category"
          value={category}
          onChange={(e) =>
            handleCategoryChange(
              e.target.value
            )
          }
          options={[
            {
              label: "Select Category",
              value: "",
            },

            ...categories.map(
              (category) => ({
                label: category,
                value: category,
              })
            ),
          ]}
        />

        {/* Flavor */}
        {!isNewFlavor ? (
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
                label: category
                  ? "Select Flavor"
                  : "Select Category First",
                value: "",
              },

              ...availableFlavors.map(
                (flavor) => ({
                  label: flavor,
                  value: flavor,
                })
              ),

              ...(category
                ? [
                    {
                      label:
                        "+ Add New Flavor",
                      value:
                        "__NEW_FLAVOR__",
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <div>
            <Input
              label="New Flavor"
              value={flavor}
              onChange={(e) =>
                handleNewFlavorChange(
                  e.target.value
                )
              }
              placeholder="e.g. Strawberry Cheesecake"
            />

            <button
              type="button"
              onClick={() => {
                setIsNewFlavor(false);
                setFlavor("");
                setError("");
              }}
              className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              ← Choose existing flavor
            </button>
          </div>
        )}

        {/* Product Code */}
        <Input
          label="Product Code"
          value={generatedCode}
          disabled
          placeholder="Generated automatically"
        />

        {/* Unit */}
        <Input
          label="Unit"
          value={unit}
          disabled
        />

        {/* Product Name */}
        <div className="sm:col-span-2">
          <Input
            label="Product Name"
            value={productName}
            disabled
            placeholder="Generated automatically"
          />
        </div>

        {/* Minimum Stock */}
        <Input
          label="Minimum Stock"
          type="number"
          min={0}
          value={minimumStock}
          onChange={(e) =>
            setMinimumStock(
              Number(e.target.value)
            )
          }
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button type="submit">
          Save Product
        </Button>
      </div>
    </form>
  );
}