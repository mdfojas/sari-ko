import { apiFetch, ApiError } from './api-client';

export interface Product {
  id: number;
  name: string;
  other_names: string[];
  barcode: string | null;
  sale_price: number;
  selected_store_price_id: number | null;
  original_price: number | null;
  selected_store_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStorePriceInput {
  store_name: string;
  price: number;
  selected?: boolean;
}

export interface CreateProductInput {
  name: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  store_prices: CreateStorePriceInput[];
}

export interface UpdateProductInput {
  name?: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  selected_store_price_id?: number;
}

export function listProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('/products');
}

export function searchProducts(query: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/products/search?q=${encodeURIComponent(query)}`);
}

export async function getProductByBarcode(code: string): Promise<Product | null> {
  try {
    return await apiFetch<Product>(`/products/barcode/${encodeURIComponent(code)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function createProduct(input: CreateProductInput): Promise<Product> {
  return apiFetch<Product>('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: number): Promise<void> {
  return apiFetch<void>(`/products/${id}`, { method: 'DELETE' });
}
