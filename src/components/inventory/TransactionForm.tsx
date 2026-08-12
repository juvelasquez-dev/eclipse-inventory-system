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
  const {
    products,
    transactions,
  } = useInventory();


  const [productId, setProductId] = useState(
    products[0]?.id ?? ""
  );

  const [quantity, setQuantity] =
    useState(1);

  const [remarks, setRemarks] =
    useState("");


  function getCurrentStock(
    productId: string
  ) {
    return transactions
      .filter(
        (transaction) =>
          transaction.productId === productId
      )
      .reduce((total, transaction) => {

        if (transaction.type === "IN") {
          return total + transaction.quantity;
        }

        return total - transaction.quantity;

      }, 0);
  }


  const selectedProduct =
    products.find(
      (product) =>
        product.id === productId
    );


  const currentStock =
    selectedProduct
      ? getCurrentStock(selectedProduct.id)
      : 0;


  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();


    if (!productId) {
      return;
    }


    if (quantity <= 0) {
      return;
    }


    if (
      type === "OUT" &&
      quantity > currentStock
    ) {
      return;
    }


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
        options={[
          {
            value: "",
            label:
              "Select Product",
          },

          ...products.map(
            (product) => ({
              value: product.id,
              label:
                `${product.code} - ${product.name}`,
            })
          ),
        ]}
      />


      {selectedProduct && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">

          <p className="font-medium text-slate-700">
            {selectedProduct.name}
          </p>

          <p className="text-slate-500">
            Unit: {selectedProduct.unit}
          </p>


          {type === "OUT" && (
            <p className="mt-1 font-semibold text-amber-700">
              Available Stock: {currentStock} {selectedProduct.unit}
            </p>
          )}

        </div>
      )}



      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

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
          {
            type === "IN"
              ? "Save Stock In"
              : "Release Stock"
          }
        </Button>

      </div>

    </form>
  );
}