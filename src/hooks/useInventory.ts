import { useInventoryContext } from "../context/InventoryContext";

export function useInventory() {
  const context = useInventoryContext();

  const totalProducts =
    context.products.length;

  const totalStock =
    context.inventory.reduce(
      (sum, item) => sum + item.stock,
      0
    );

  const today = new Date()
    .toISOString()
    .split("T")[0];

  const stockInToday =
    context.transactions
      .filter(
        (transaction) =>
          transaction.type === "IN" &&
          transaction.date === today
      )
      .reduce(
        (sum, transaction) =>
          sum + transaction.quantity,
        0
      );

  const stockOutToday =
    context.transactions
      .filter(
        (transaction) =>
          transaction.type === "OUT" &&
          transaction.date === today
      )
      .reduce(
        (sum, transaction) =>
          sum + transaction.quantity,
        0
      );

  return {
    ...context,
    totalProducts,
    totalStock,
    stockInToday,
    stockOutToday,
  };
}