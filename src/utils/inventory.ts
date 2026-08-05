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

      return total - transaction.quantity;
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