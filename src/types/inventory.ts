export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  minimumStock: number;
}


export interface Transaction {
  id: string;
  productId: string;
  type: "IN" | "OUT";
  quantity: number;
  date: string;
  remarks?: string;
}