import { useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";

import type { Product } from "../../types/inventory";

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
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [category, setCategory] = useState(initialValues?.category ?? "");
  const [unit, setUnit] = useState(initialValues?.unit ?? "");
  const [minimumStock, setMinimumStock] = useState(
    initialValues?.minimumStock ?? 0
  );

  const [error, setError] = useState("");

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!code.trim()) {
      setError("Product code is required.");
      return;
    }

    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!category.trim()) {
      setError("Category is required.");
      return;
    }

    if (!unit.trim()) {
      setError("Unit is required.");
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
      code,
      name,
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
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm0 3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Product Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <Input
          label="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <Input
          label="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />

        <Input
          label="Minimum Stock"
          type="number"
          value={minimumStock}
          onChange={(e) =>
            setMinimumStock(Number(e.target.value))
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