import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Product,
  Transaction,
} from "../types/inventory";

import { getInventory } from "../utils/inventory";
import { supabase } from "../lib/supabase";

interface InventoryContextType {
  products: Product[];

  transactions: Transaction[];

  inventory: (Product & {
    stock: number;
  })[];

  addProduct: (
    product: Product
  ) => Promise<boolean>;

  updateProduct: (
    product: Product
  ) => Promise<boolean>;

  deleteProduct: (
    id: string
  ) => Promise<boolean>;

  addTransaction: (
    transaction: Transaction
  ) => Promise<boolean>;
}

const InventoryContext =
  createContext<InventoryContextType | null>(
    null
  );

interface Props {
  children: ReactNode;
}

/*
 * Convert Supabase product data
 * from snake_case to frontend camelCase.
 */
function mapProduct(row: any): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: row.price,
    minimumStock: row.minimum_stock,
  };
}

/*
 * Convert Supabase transaction data
 * from snake_case to frontend camelCase.
 */
function mapTransaction(
  row: any
): Transaction {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantity: row.quantity,
    date: row.date,
    remarks: row.remarks ?? "",
  };
}

export function InventoryProvider({
  children,
}: Props) {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  /*
   * Load all data from Supabase.
   */
  useEffect(() => {
    async function loadData() {
      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("*")
        .order("id");

      if (productError) {
        console.error(
          "Error loading products:",
          productError
        );
      } else {
        setProducts(
          (productData ?? []).map(
            mapProduct
          )
        );
      }

      const {
        data: transactionData,
        error: transactionError,
      } = await supabase
        .from("transactions")
        .select("*")
        .order("date", {
          ascending: false,
        });

      if (transactionError) {
        console.error(
          "Error loading transactions:",
          transactionError
        );
      } else {
        setTransactions(
          (transactionData ?? []).map(
            mapTransaction
          )
        );
      }
    }

    loadData();
  }, []);

  /*
   * Calculate inventory from products
   * and transactions.
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
   * Add product.
   */
  async function addProduct(
    product: Product
  ): Promise<boolean> {
    const exists = products.some(
      (existingProduct) =>
        existingProduct.code
          .trim()
          .toLowerCase() ===
        product.code
          .trim()
          .toLowerCase()
    );

    if (exists) {
      return false;
    }

    const { data, error } =
      await supabase
        .from("products")
        .insert({
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: product.price,
          minimum_stock:
            product.minimumStock,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Error adding product:",
        error
      );

      return false;
    }

    setProducts((prev) => [
      ...prev,
      mapProduct(data),
    ]);

    return true;
  }

  /*
   * Update product.
   */
  async function updateProduct(
    updatedProduct: Product
  ): Promise<boolean> {
    const { data, error } =
      await supabase
        .from("products")
        .update({
          code: updatedProduct.code,
          name: updatedProduct.name,
          category:
            updatedProduct.category,
          unit: updatedProduct.unit,
          price: updatedProduct.price,
          minimum_stock:
            updatedProduct.minimumStock,
        })
        .eq(
          "id",
          updatedProduct.id
        )
        .select()
        .single();

    if (error) {
      console.error(
        "Error updating product:",
        error
      );

      return false;
    }

    setProducts((prev) =>
      prev.map((product) =>
        product.id ===
        updatedProduct.id
          ? mapProduct(data)
          : product
      )
    );

    return true;
  }

  /*
   * Delete product.
   *
   * Products with transaction history
   * cannot be deleted.
   */
  async function deleteProduct(
    id: string
  ): Promise<boolean> {
    const hasTransactions =
      transactions.some(
        (transaction) =>
          transaction.productId === id
      );

    if (hasTransactions) {
      return false;
    }

    const { error } =
      await supabase
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Error deleting product:",
        error
      );

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
   * Add transaction.
   */
  async function addTransaction(
    transaction: Transaction
  ): Promise<boolean> {
    const productExists =
      products.some(
        (product) =>
          product.id ===
          transaction.productId
      );

    if (!productExists) {
      return false;
    }

    const { data, error } =
      await supabase
        .from("transactions")
        .insert({
          id: transaction.id,
          product_id:
            transaction.productId,
          type: transaction.type,
          quantity:
            transaction.quantity,
          date: transaction.date,
          remarks:
            transaction.remarks ?? "",
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Error adding transaction:",
        error
      );

      return false;
    }

    setTransactions((prev) => [
      ...prev,
      mapTransaction(data),
    ]);

    return true;
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