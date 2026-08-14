import type {
  Product,
  Transaction,
} from "../types/inventory";

export function calculateStock(
  productId: string,
  transactions: Transaction[]
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

      if (transaction.type === "OUT") {
        return total - transaction.quantity;
      }

      // ADJUSTMENT
      // Positive quantity adds stock.
      // Negative quantity removes stock.
      return total + transaction.quantity;
    }, 0);
}

export function getInventory(
  products: Product[],
  transactions: Transaction[]
) {
  return products.map((product) => ({
    ...product,
    stock: calculateStock(
      product.id,
      transactions
    ),
  }));
}