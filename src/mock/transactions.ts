import type { Transaction } from "../types/inventory";

export const transactions: Transaction[] = [
  {
    id: "T001",
    productId: "P001",
    type: "IN",
    quantity: 100,
    date: "2026-08-01",
    remarks: "Initial stock",
  },
  {
    id: "T002",
    productId: "P001",
    type: "OUT",
    quantity: 25,
    date: "2026-08-02",
    remarks: "Delivered",
  },
  {
    id: "T003",
    productId: "P002",
    type: "IN",
    quantity: 80,
    date: "2026-08-01",
  },
  {
    id: "T004",
    productId: "P003",
    type: "OUT",
    quantity: 10,
    date: "2026-08-03",
  },
];