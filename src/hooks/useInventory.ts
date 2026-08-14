import { useInventoryContext } from "../context/InventoryContext";

export function useInventory() {
  const context = useInventoryContext();

  /*
   * Basic inventory totals
   */
  const totalProducts =
    context.products.length;

  const totalStock =
    context.inventory.reduce(
      (sum, item) =>
        sum + item.stock,
      0
    );

  /*
   * Today's date
   */
  const today = new Date()
    .toISOString()
    .split("T")[0];

  /*
   * Stock In today
   */
  const stockInToday =
    context.transactions
      .filter((transaction) => {
        if (transaction.type !== "IN") {
          return false;
        }

        const transactionDate =
          new Date(transaction.date)
            .toISOString()
            .split("T")[0];

        return transactionDate === today;
      })
      .reduce(
        (sum, transaction) =>
          sum + transaction.quantity,
        0
      );

  /*
   * Stock Out today
   */
  const stockOutToday =
    context.transactions
      .filter((transaction) => {
        if (transaction.type !== "OUT") {
          return false;
        }

        const transactionDate =
          new Date(transaction.date)
            .toISOString()
            .split("T")[0];

        return transactionDate === today;
      })
      .reduce(
        (sum, transaction) =>
          sum + transaction.quantity,
        0
      );

  /*
   * Get current stock of a product.
   *
   * IN          = add
   * OUT         = subtract
   * ADJUSTMENT  = add/subtract based
   *               on the quantity sign.
   */
  function getProductStock(
    productId: string
  ) {
    return context.transactions
      .filter(
        (transaction) =>
          transaction.productId === productId
      )
      .reduce(
        (total, transaction) => {
          if (transaction.type === "IN") {
            return (
              total + transaction.quantity
            );
          }

          if (transaction.type === "OUT") {
            return (
              total - transaction.quantity
            );
          }

          // ADJUSTMENT
          // Positive = add stock
          // Negative = remove stock
          return (
            total + transaction.quantity
          );
        },
        0
      );
  }

  /*
   * Products below minimum stock.
   */
  function getLowStockProducts() {
    return context.inventory.filter(
      (product) =>
        product.stock > 0 &&
        product.stock <= product.minimumStock
    );
  }

  /*
   * Products with zero stock.
   */
  function getOutOfStockProducts() {
    return context.inventory.filter(
      (product) =>
        product.stock <= 0
    );
  }

  /*
   * Check before Stock Out.
   */
  function hasEnoughStock(
    productId: string,
    quantity: number
  ) {
    return (
      getProductStock(productId) >= quantity
    );
  }

  /*
   * Get total quantity moved for a product.
   *
   * This is based ONLY on real transactions.
   *
   * Useful for Dashboard charts:
   * - Most stocked products
   * - Most ordered products
   * - Most frequently moved flavors
   */
  function getProductMovement(
    productId: string
  ) {
    return context.transactions
      .filter(
        (transaction) =>
          transaction.productId === productId
      )
      .reduce(
        (movement, transaction) => {
          if (transaction.type === "IN") {
            movement.stockIn +=
              transaction.quantity;
          }

          if (transaction.type === "OUT") {
            movement.stockOut +=
              transaction.quantity;
          }

          if (
            transaction.type ===
            "ADJUSTMENT"
          ) {
            if (transaction.quantity >= 0) {
              movement.adjustmentIn +=
                transaction.quantity;
            } else {
              movement.adjustmentOut +=
                Math.abs(
                  transaction.quantity
                );
            }
          }

          return movement;
        },
        {
          stockIn: 0,
          stockOut: 0,
          adjustmentIn: 0,
          adjustmentOut: 0,
        }
      );
  }

  /*
   * Get all products with their transaction
   * movement totals.
   *
   * This will allow the Dashboard to create
   * charts without adding fake/mock data.
   */
  function getProductMovementSummary() {
    return context.products.map(
      (product) => {
        const movement =
          getProductMovement(
            product.id
          );

        return {
          ...product,

          stock:
            context.inventory.find(
              (item) =>
                item.id === product.id
            )?.stock ?? 0,

          stockIn:
            movement.stockIn,

          stockOut:
            movement.stockOut,

          adjustmentIn:
            movement.adjustmentIn,

          adjustmentOut:
            movement.adjustmentOut,

          totalMoved:
            movement.stockIn +
            movement.stockOut +
            movement.adjustmentIn +
            movement.adjustmentOut,
        };
      }
    );
  }

  /*
   * Get products ranked by Stock Out quantity.
   *
   * This represents the flavors/products that
   * have been ordered/removed from inventory
   * the most.
   */
  function getMostOrderedProducts() {
    return getProductMovementSummary()
      .filter(
        (product) =>
          product.stockOut > 0
      )
      .sort(
        (a, b) =>
          b.stockOut - a.stockOut
      );
  }

  /*
   * Get products ranked by Stock In quantity.
   *
   * This represents the flavors/products that
   * have received the most incoming stock.
   */
  function getMostStockedProducts() {
    return getProductMovementSummary()
      .filter(
        (product) =>
          product.stockIn > 0
      )
      .sort(
        (a, b) =>
          b.stockIn - a.stockIn
      );
  }

  return {
    ...context,

    // Dashboard data
    totalProducts,
    totalStock,
    stockInToday,
    stockOutToday,

    // Inventory helpers
    getProductStock,
    getLowStockProducts,
    getOutOfStockProducts,
    hasEnoughStock,

    // Product movement
    getProductMovement,
    getProductMovementSummary,
    getMostOrderedProducts,
    getMostStockedProducts,
  };
}