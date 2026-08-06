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
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

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

  const inventory = useMemo(
    () =>
      getInventory(
        products,
        transactions
      ),
    [products, transactions]
  );

  useEffect(() => {
    saveProducts(products);
  }, [products]);

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  function addProduct(product: Product) {
    setProducts((prev) => [
      ...prev,
      product,
    ]);
  }

  function updateProduct(
    updatedProduct: Product
  ) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === updatedProduct.id
          ? updatedProduct
          : product
      )
    );
  }

  function deleteProduct(id: string) {
    setProducts((prev) =>
      prev.filter(
        (product) => product.id !== id
      )
    );
  }

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