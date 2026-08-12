import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { products as initialProducts } from "../mock/products";
import { transactions as initialTransactions } from "../mock/transactions";

import type {
  Product,
  Transaction,
} from "../types/inventory";

import { getInventory } from "../utils/inventory";

import {
  loadProducts,
  loadTransactions,
  saveProducts,
  saveTransactions,
} from "../utils/storage";

interface InventoryContextType {
  products: Product[];

  transactions: Transaction[];

  inventory: (Product & {
    stock: number;
  })[];

  addProduct: (product: Product) => void;

  updateProduct: (
    product: Product
  ) => void;

  deleteProduct: (
    id: string
  ) => boolean;

  addTransaction: (
    transaction: Transaction
  ) => void;
}

const InventoryContext =
  createContext<InventoryContextType | null>(
    null
  );

interface Props {
  children: ReactNode;
}

export function InventoryProvider({
  children,
}: Props) {
  const [products, setProducts] =
    useState<Product[]>(() => {
      return (
        loadProducts() ??
        initialProducts
      );
    });

  const [transactions, setTransactions] =
    useState<Transaction[]>(() => {
      return (
        loadTransactions() ??
        initialTransactions
      );
    });

  /*
   * Calculate inventory from products
   * and their transactions.
   */
  const inventory = useMemo(
    () =>
      getInventory(
        products,
        transactions
      ),
    [products, transactions]
  );

  /*
   * Save products whenever they change.
   */
  useEffect(() => {
    saveProducts(products);
  }, [products]);

  /*
   * Save transactions whenever they change.
   */
  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  /*
   * Add a new product.
   */
  function addProduct(
    product: Product
  ) {
    setProducts((prev) => [
      ...prev,
      product,
    ]);
  }

  /*
   * Update an existing product.
   */
  function updateProduct(
    updatedProduct: Product
  ) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id ===
        updatedProduct.id
          ? updatedProduct
          : product
      )
    );
  }

  /*
   * Delete a product.
   *
   * Products with transaction history
   * cannot be deleted because their
   * transactions need to remain intact.
   */
  function deleteProduct(
    id: string
  ): boolean {
    const hasTransactions =
      transactions.some(
        (transaction) =>
          transaction.productId === id
      );

    if (hasTransactions) {
      return false;
    }

    setProducts((prev) =>
      prev.filter(
        (product) =>
          product.id !== id
      )
    );

    return true;
  }

  /*
   * Add a stock transaction.
   */
  function addTransaction(
    transaction: Transaction
  ) {
    setTransactions((prev) => [
      ...prev,
      transaction,
    ]);
  }

  return (
    <InventoryContext.Provider
      value={{
        products,
        transactions,
        inventory,

        addProduct,
        updateProduct,
        deleteProduct,

        addTransaction,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventoryContext() {
  const context = useContext(
    InventoryContext
  );

  if (!context) {
    throw new Error(
      "useInventoryContext must be used inside InventoryProvider."
    );
  }

  return context;
}