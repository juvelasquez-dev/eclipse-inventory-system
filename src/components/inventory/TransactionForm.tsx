import { useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

import { useInventory } from "../../hooks/useInventory";

type TransactionType = "IN" | "OUT";

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
  const { products } = useInventory();

  const [productId, setProductId] = useState(
    products[0]?.id ?? ""
  );

  const [quantity, setQuantity] = useState(1);

  const [remarks, setRemarks] = useState("");

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!productId || quantity <= 0) return;

    onSubmit({
      productId,
      quantity,
      remarks,
    });

    setQuantity(1);
    setRemarks("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <Select
        label="Product"
        value={productId}
        onChange={(e) =>
          setProductId(e.target.value)
        }
        options={products.map((product) => ({
          value: product.id,
          label: product.name,
        }))}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) =>
            setQuantity(Number(e.target.value))
          }
        />

        <Input
          label="Remarks"
          value={remarks}
          onChange={(e) =>
            setRemarks(e.target.value)
          }
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button type="submit">
          {type === "IN"
            ? "Save Stock In"
            : "Save Stock Out"}
        </Button>
      </div>
    </form>
  );
}