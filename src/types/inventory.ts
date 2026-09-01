export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
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

export type OutletStatus = "Active" | "Inactive";

export interface Outlet {
  id: string;
  outletName: string;
  contactPerson: string;
  contactNumber: string;
  completeAddress: string;
  areaCode: string;
  tin: string;
  status: OutletStatus;
  createdAt?: string;
  updatedAt?: string;
}