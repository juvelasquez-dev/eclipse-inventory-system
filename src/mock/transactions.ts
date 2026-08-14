import type { Transaction } from "../types/inventory";

export const transactions: Transaction[] = [
  {
    id: "T001",
    productId: "P001",
    type: "IN",
    quantity: 100,
    date: "2026-08-01T08:00:00+08:00",
    remarks: "Initial stock",
  },
  {
    id: "T003",
    productId: "P002",
    type: "IN",
    quantity: 80,
    date: "2026-08-01T09:30:00+08:00",
  },
  {
    id: "T002",
    productId: "P001",
    type: "OUT",
    quantity: 25,
    date: "2026-08-02T10:15:00+08:00",
    remarks: "Delivered",
  },
  {
    id: "T004",
    productId: "P003",
    type: "OUT",
    quantity: 10,
    date: "2026-08-03T14:00:00+08:00",
  },
];