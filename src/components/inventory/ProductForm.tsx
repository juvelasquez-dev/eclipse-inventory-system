import { useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

import { categories } from "../../mock/categories";
import { flavorsByCategory } from "../../mock/flavors";
import { generateProductCode } from "../../utils/productCode";

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

  const [minimumStock, setMinimumStock] = useState(
    initialValues?.minimumStock ?? 0
  );

  const [error, setError] = useState("");

  const unit = categoryUnits[category] ?? "";

  const availableFlavors =
    flavorsByCategory[
      category as keyof typeof flavorsByCategory
    ] ?? [];

  const productName =
    flavor && category
      ? `${flavor} ${category}`
      : "";

  const generatedCode =
    category && flavor
      ? generateProductCode(category, flavor)
      : "";

  function handleCategoryChange(value: string) {
    setCategory(value);
    setFlavor("");
    setError("");
  }

  function handleFlavorChange(value: string) {
    setFlavor(value);
    setError("");
  }

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!category) {
      setError("Category is required.");
      return;
    }

    if (!flavor) {
      setError("Flavor is required.");
      return;
    }

    if (!unit) {
      setError("Unit could not be determined.");
      return;
    }

    if (!generatedCode) {
      setError("Product code could not be generated.");
      return;
    }

    if (minimumStock < 0) {
      setError(
        "Minimum stock cannot be negative."
      );
      return;
    }

    setError("");

    onSubmit({
      code: generatedCode,
      name: productName,
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
            ...categories.map((category) => ({
              label: category,
              value: category,
            })),
          ]}
        />

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
            ...availableFlavors.map((flavor) => ({
              label: flavor,
              value: flavor,
            })),
          ]}
        />

        <Input
          label="Product Code"
          value={generatedCode}
          disabled
          placeholder="Generated automatically"
        />

        <Input
          label="Unit"
          value={unit}
          disabled
        />

        <div className="sm:col-span-2">
          <Input
            label="Product Name"
            value={productName}
            disabled
            placeholder="Generated automatically"
          />
        </div>

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

