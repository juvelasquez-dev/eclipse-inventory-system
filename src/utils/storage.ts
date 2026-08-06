import type {
  Product,
  Transaction,
} from "../types/inventory";

const PRODUCTS_KEY = "inventory-products";
const TRANSACTIONS_KEY = "inventory-transactions";

export function loadProducts(): Product[] | null {
  const data = localStorage.getItem(PRODUCTS_KEY);

  if (!data) return null;

  return JSON.parse(data);
}

export function saveProducts(
  products: Product[]
) {
  localStorage.setItem(
    PRODUCTS_KEY,
    JSON.stringify(products)
  );
}

export function loadTransactions():
  | Transaction[]
  | null {
  const data = localStorage.getItem(
    TRANSACTIONS_KEY
  );

  if (!data) return null;

  return JSON.parse(data);
}

export function saveTransactions(
  transactions: Transaction[]
) {
  localStorage.setItem(
    TRANSACTIONS_KEY,
    JSON.stringify(transactions)
  );
}