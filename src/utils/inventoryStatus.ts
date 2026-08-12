export type InventoryStatus =
  | "AVAILABLE"
  | "LOW"
  | "OUT";


export function getInventoryStatus(
  stock: number,
  minimumStock: number
): InventoryStatus {

  if (stock === 0) {
    return "OUT";
  }

  if (stock <= minimumStock) {
    return "LOW";
  }

  return "AVAILABLE";
}