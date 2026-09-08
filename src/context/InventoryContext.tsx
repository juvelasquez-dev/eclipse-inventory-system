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
  Outlet,
} from "../types/inventory";

import { getInventory } from "../utils/inventory";
import { supabase } from "../lib/supabase";

interface InventoryContextType {
  products: Product[];

  transactions: Transaction[];

  outlets: Outlet[];

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

  addOutlet: (
    outlet: Omit<
      Outlet,
      "id" | "createdAt" | "updatedAt"
    >
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;

  updateOutlet: (
    outlet: Outlet
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;

  deleteOutlet: (
    id: string
  ) => Promise<boolean>;

  refreshOutlets: () => Promise<void>;
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

/*
 * Convert Supabase outlet data
 * from snake_case to frontend camelCase.
 */
function mapOutlet(row: any): Outlet {
  return {
    id: row.id,
    outletName: row.outlet_name,
    contactPerson: row.contact_person,
    degicNumber: row.degic_number ?? "",
    contactNumber: row.contact_number,
    completeAddress: row.complete_address,
    areaCode: row.area_code,
    tin: row.tin ?? "",
    idType: row.id_type ?? "",
    idNumber: row.id_number ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicateOutlet(
  existingOutlet: Outlet,
  candidate: {
    outletName: string;
    completeAddress: string;
  }
) {
  return (
    existingOutlet.outletName
      .trim()
      .toLowerCase() ===
      candidate.outletName
        .trim()
        .toLowerCase() &&
    existingOutlet.completeAddress
      .trim()
      .toLowerCase() ===
      candidate.completeAddress
        .trim()
        .toLowerCase()
  );
}

function getDuplicateOutletMessage() {
  return "An outlet with the same name and address already exists.";
}

function getSupabaseOutletErrorMessage(
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  }
) {
  const code = error?.code ?? "";
  const message =
    error?.message?.toLowerCase() ?? "";

  if (
    code === "23505" ||
    message.includes("duplicate") ||
    message.includes("already exists")
  ) {
    return getDuplicateOutletMessage();
  }

  return (
    error?.message ||
    "This outlet could not be saved. Please review the information and try again."
  );
}

export function InventoryProvider({
  children,
}: Props) {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [outlets, setOutlets] =
    useState<Outlet[]>([]);

  /*
   * Load outlets from Supabase.
   */
  async function loadOutlets() {
    const {
      data: outletData,
      error: outletError,
    } = await supabase
      .from("outlets")
      .select("*")
      .order("outlet_name", {
        ascending: true,
      });

    if (outletError) {
      console.error(
        "Error loading outlets:",
        outletError
      );
      return;
    }

    setOutlets(
      (outletData ?? []).map(mapOutlet)
    );
  }

  /*
   * Load all data from Supabase.
   */
  useEffect(() => {
    async function loadData() {
      const {
        data: {
          session,
        },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Error checking session:",
          sessionError
        );
      }

      if (!session) {
        console.error(
          "No active Supabase session found."
        );
        return;
      }

      /*
       * Load products.
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
          (productData ?? []).map(mapProduct)
        );
      }

      /*
       * Load transactions.
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

      /*
       * Load outlets.
       */
      await loadOutlets();
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
   * Add outlet.
   */
  async function addOutlet(
    outlet: Omit<
      Outlet,
      "id" | "createdAt" | "updatedAt"
    >
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const duplicateExists =
      outlets.some((existingOutlet) =>
        isDuplicateOutlet(existingOutlet, {
          outletName: outlet.outletName,
          completeAddress:
            outlet.completeAddress,
        })
      );

    if (duplicateExists) {
      return {
        success: false,
        message: getDuplicateOutletMessage(),
      };
    }

    const { data, error } =
      await supabase
        .from("outlets")
        .insert({
          outlet_name:
            outlet.outletName,
          contact_person:
            outlet.contactPerson,
          degic_number:
            outlet.degicNumber?.trim() || null,
          contact_number:
            outlet.contactNumber,
          complete_address:
            outlet.completeAddress,
          area_code:
            outlet.areaCode,
          tin:
            outlet.tin?.trim() || null,
          id_type:
            outlet.idType?.trim() || null,
          id_number:
            outlet.idNumber?.trim() || null,
          status: outlet.status,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Error adding outlet:",
        JSON.stringify(error, null, 2)
      );

      console.error(
        "Error code:",
        error.code
      );

      console.error(
        "Error message:",
        error.message
      );

      console.error(
        "Error details:",
        error.details
      );

      console.error(
        "Error hint:",
        error.hint
      );

      return {
        success: false,
        message:
          getSupabaseOutletErrorMessage(
            error
          ),
      };
    }

    setOutlets((prev) =>
      [...prev, mapOutlet(data)].sort(
        (a, b) =>
          a.outletName.localeCompare(
            b.outletName
          )
      )
    );

    return {
      success: true,
    };
  }

  /*
   * Update outlet.
   */
  async function updateOutlet(
    updatedOutlet: Outlet
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const duplicateExists =
      outlets.some(
        (outlet) =>
          outlet.id !== updatedOutlet.id &&
          isDuplicateOutlet(outlet, {
            outletName:
              updatedOutlet.outletName,
            completeAddress:
              updatedOutlet.completeAddress,
          })
      );

    if (duplicateExists) {
      return {
        success: false,
        message: getDuplicateOutletMessage(),
      };
    }

    const { data, error } =
      await supabase
        .from("outlets")
        .update({
          outlet_name:
            updatedOutlet.outletName,
          contact_person:
            updatedOutlet.contactPerson,
          degic_number:
            updatedOutlet.degicNumber?.trim() || null,
          contact_number:
            updatedOutlet.contactNumber,
          complete_address:
            updatedOutlet.completeAddress,
          area_code:
            updatedOutlet.areaCode,
          tin:
            updatedOutlet.tin?.trim() ||
            null,
          id_type:
            updatedOutlet.idType?.trim() ||
            null,
          id_number:
            updatedOutlet.idNumber?.trim() ||
            null,
          status:
            updatedOutlet.status,
        })
        .eq(
          "id",
          updatedOutlet.id
        )
        .select()
        .single();

    if (error) {
      console.error(
        "Error updating outlet:",
        JSON.stringify(error, null, 2)
      );

      console.error(
        "Error code:",
        error.code
      );

      console.error(
        "Error message:",
        error.message
      );

      console.error(
        "Error details:",
        error.details
      );

      console.error(
        "Error hint:",
        error.hint
      );

      return {
        success: false,
        message:
          getSupabaseOutletErrorMessage(
            error
          ),
      };
    }

    setOutlets((prev) =>
      prev
        .map((outlet) =>
          outlet.id === updatedOutlet.id
            ? mapOutlet(data)
            : outlet
        )
        .sort(
          (a, b) =>
            a.outletName.localeCompare(
              b.outletName
            )
        )
    );

    return {
      success: true,
    };
  }

  /*
   * Delete outlet.
   */
  async function deleteOutlet(
    id: string
  ): Promise<boolean> {
    const { error } =
      await supabase
        .from("outlets")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Error deleting outlet:",
        error
      );

      return false;
    }

    setOutlets((prev) =>
      prev.filter(
        (outlet) =>
          outlet.id !== id
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

    if (transaction.type === "OUT") {
      const { data, error } =
        await supabase.rpc(
          "create_stock_out_transaction",
          {
            p_transaction_id:
              transaction.id,
            p_product_id:
              transaction.productId,
            p_quantity:
              transaction.quantity,
            p_date: transaction.date,
            p_remarks:
              transaction.remarks ?? "",
          }
        );

      if (error) {
        console.error(
          "Error adding transaction:",
          error
        );

        return false;
      }

      const row = Array.isArray(data)
        ? data[0]
        : data;

      setTransactions((prev) => [
        ...prev,
        mapTransaction(row),
      ]);

      return true;
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
        outlets,
        inventory,

        addProduct,
        updateProduct,
        deleteProduct,
        addTransaction,

        addOutlet,
        updateOutlet,
        deleteOutlet,

        refreshOutlets:
          loadOutlets,
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