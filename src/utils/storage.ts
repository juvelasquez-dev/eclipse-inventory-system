import type {
  Product,
  Transaction,
} from "../types/inventory";

const PRODUCTS_KEY = "inventory-products";
const TRANSACTIONS_KEY = "inventory-transactions";
const CUSTOM_FLAVORS_KEY = "inventory-custom-flavors";

const PRODUCT_CATALOG_VERSION = "2";

export function loadProducts(): Product[] | null {
  const versionKey =
    "inventory-product-catalog-version";

  const currentVersion =
    localStorage.getItem(versionKey);

  // Reset the old product catalog when
  // the catalog version changes.
  if (
    currentVersion !==
    PRODUCT_CATALOG_VERSION
  ) {
    localStorage.removeItem(PRODUCTS_KEY);

    localStorage.setItem(
      versionKey,
      PRODUCT_CATALOG_VERSION
    );

    return null;
  }

  const data =
    localStorage.getItem(PRODUCTS_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as Product[];
  } catch {
    localStorage.removeItem(PRODUCTS_KEY);
    return null;
  }
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
  const data =
    localStorage.getItem(
      TRANSACTIONS_KEY
    );

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as Transaction[];
  } catch {
    localStorage.removeItem(
      TRANSACTIONS_KEY
    );

    return null;
  }
}

export function saveTransactions(
  transactions: Transaction[]
) {
  localStorage.setItem(
    TRANSACTIONS_KEY,
    JSON.stringify(transactions)
  );
}

/* -------------------------------- */
/* Custom Flavor Storage             */
/* -------------------------------- */

export function loadCustomFlavors(): Record<
  string,
  string[]
> {
  const data = localStorage.getItem(
    CUSTOM_FLAVORS_KEY
  );

  if (!data) {
    return {};
  }

  try {
    return JSON.parse(data) as Record<
      string,
      string[]
    >;
  } catch {
    localStorage.removeItem(
      CUSTOM_FLAVORS_KEY
    );

    return {};
  }
}

export function saveCustomFlavors(
  flavors: Record<string, string[]>
) {
  localStorage.setItem(
    CUSTOM_FLAVORS_KEY,
    JSON.stringify(flavors)
  );
}