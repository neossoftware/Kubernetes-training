export interface Product {
  id?: number;
  name: string;
  price: number;
  stock: number;
  description?: string;
}

export interface ProductsResponse {
  data: Product[];
  total: number;
}
