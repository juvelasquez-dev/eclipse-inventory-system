import { useInventoryContext } from "../context/InventoryContext";

export function useInventory() {
  const context = useInventoryContext();


  const totalProducts =
    context.products.length;


  const totalStock =
    context.inventory.reduce(
      (sum, item) =>
        sum + item.stock,
      0
    );


  const today = new Date()
    .toISOString()
    .split("T")[0];


  const stockInToday =
    context.transactions
      .filter(
        (transaction) =>
          transaction.type === "IN" &&
          transaction.date === today
      )
      .reduce(
        (sum, transaction) =>
          sum + transaction.quantity,
        0
      );


  const stockOutToday =
    context.transactions
      .filter(
        (transaction) =>
          transaction.type === "OUT" &&
          transaction.date === today
      )
      .reduce(
        (sum, transaction) =>
          sum + transaction.quantity,
        0
      );



  // Get current stock of a product
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
            return total + transaction.quantity;
          }

          return total - transaction.quantity;

        },
        0
      );
  }



  // Products below minimum stock
  function getLowStockProducts() {
    return context.inventory.filter(
      (product) =>
        product.stock > 0 &&
        product.stock <= product.minimumStock
    );
  }



  // Products with zero stock
  function getOutOfStockProducts() {
    return context.inventory.filter(
      (product) =>
        product.stock === 0
    );
  }



  // Check before Stock Out
  function hasEnoughStock(
    productId: string,
    quantity: number
  ) {
    return (
      getProductStock(productId) >= quantity
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
  };
}