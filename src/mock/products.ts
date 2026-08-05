import type { Product } from "../types/inventory";

export const products: Product[] = [
  {
    id: "P001",
    code: "ICE-001",
    name: "Chocolate Ice Cream 1L",
    category: "Ice Cream",
    unit: "Tub",
    minimumStock: 20,
  },
  {
    id: "P002",
    code: "ICE-002",
    name: "Vanilla Ice Cream 1L",
    category: "Ice Cream",
    unit: "Tub",
    minimumStock: 15,
  },
  {
    id: "P003",
    code: "ICE-003",
    name: "Mango Ice Cream 1L",
    category: "Ice Cream",
    unit: "Tub",
    minimumStock: 10,
  },
];