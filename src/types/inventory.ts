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

export const OUTLET_ID_TYPE_OPTIONS = [
  "Select ID Type",
  "Driver's License",
  "Passport",
  "PhilSys ID",
  "UMID",
  "SSS ID",
  "GSIS ID",
  "PRC ID",
  "Voter's ID",
  "Senior Citizen ID",
  "Company ID",
  "Other",
] as const;

export type OutletIdType =
  | "Driver's License"
  | "Passport"
  | "PhilSys ID"
  | "UMID"
  | "SSS ID"
  | "GSIS ID"
  | "PRC ID"
  | "Voter's ID"
  | "Senior Citizen ID"
  | "Company ID"
  | "Other";

export interface Outlet {
  id: string;
  outletName: string;
  contactPerson: string;
  degicNumber: string;
  contactNumber: string;
  completeAddress: string;
  areaCode: string;
  tin?: string;
  idType?: string;
  idNumber?: string;
  status: OutletStatus;
  createdAt?: string;
  updatedAt?: string;
}