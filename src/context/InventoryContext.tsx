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

  addProduct: (product: Product) => boolean;

  updateProduct: (
    product: Product
  ) => void;

  deleteProduct: (
    id: string
  ) => boolean;

  addTransaction: (
    transaction: Transaction
  ) => boolean;
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
 * from snake_case to our frontend
 * camelCase structure.
 */
function mapProduct(row: any): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    minimumStock: row.minimum_stock,
  };
}

/*
 * Convert Supabase transaction data
 * from snake_case to our frontend
 * camelCase structure.
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
   * Load products and transactions
   * from Supabase when the app starts.
   */
  useEffect(() => {
    async function loadData() {
      /*
       * Load products
       */
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

      /*
       * Load transactions
       */
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
   * Add a new product.
   *
   * Prevent duplicate product codes.
   */
  function addProduct(
    product: Product
  ): boolean {
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

    /*
     * Optimistically add to UI.
     */
    setProducts((prev) => [
      ...prev,
      product,
    ]);

    /*
     * Save to Supabase.
     */
    void (async () => {
      const { error } =
        await supabase
          .from("products")
          .insert({
            id: product.id,
            code: product.code,
            name: product.name,
            category: product.category,
            unit: product.unit,
            minimum_stock:
              product.minimumStock,
          });

      if (error) {
        console.error(
          "Error adding product:",
          error
        );

        /*
         * Roll back optimistic update.
         */
        setProducts((prev) =>
          prev.filter(
            (item) =>
              item.id !== product.id
          )
        );
      }
    })();

    return true;
  }

  /*
   * Update an existing product.
   */
  function updateProduct(
    updatedProduct: Product
  ) {
    /*
     * Update UI immediately.
     */
    setProducts((prev) =>
      prev.map((product) =>
        product.id ===
        updatedProduct.id
          ? updatedProduct
          : product
      )
    );

    /*
     * Update Supabase.
     */
    void (async () => {
      const { error } =
        await supabase
          .from("products")
          .update({
            code: updatedProduct.code,
            name: updatedProduct.name,
            category:
              updatedProduct.category,
            unit: updatedProduct.unit,
            minimum_stock:
              updatedProduct.minimumStock,
          })
          .eq(
            "id",
            updatedProduct.id
          );

      if (error) {
        console.error(
          "Error updating product:",
          error
        );
      }
    })();
  }

  /*
   * Delete a product.
   *
   * Products with transaction history
   * cannot be deleted.
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

    /*
     * Remove from UI immediately.
     */
    setProducts((prev) =>
      prev.filter(
        (product) =>
          product.id !== id
      )
    );

    /*
     * Delete from Supabase.
     */
    void (async () => {
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
      }
    })();

    return true;
  }

  /*
   * Add a stock transaction.
   *
   * IN
   * OUT
   * ADJUSTMENT
   */
  function addTransaction(
    transaction: Transaction
  ): boolean {
    const productExists =
      products.some(
        (product) =>
          product.id ===
          transaction.productId
      );

    if (!productExists) {
      return false;
    }

    /*
     * Optimistically add transaction
     * to the UI.
     */
    setTransactions((prev) => [
      ...prev,
      transaction,
    ]);

    /*
     * Save transaction to Supabase.
     */
    void (async () => {
      const { error } =
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
          });

      if (error) {
        console.error(
          "Error adding transaction:",
          error
        );

        /*
         * Roll back optimistic update.
         */
        setTransactions((prev) =>
          prev.filter(
            (item) =>
              item.id !==
              transaction.id
          )
        );
      }
    })();

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