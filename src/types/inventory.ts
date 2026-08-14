export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  minimumStock: number;
}

export type TransactionType =
  | "IN"
  | "OUT"
  | "ADJUSTMENT";

export interface Transaction {
  id: string;
  productId: string;
  type: TransactionType;
  quantity: number;
  date: string;
  remarks?: string;
}