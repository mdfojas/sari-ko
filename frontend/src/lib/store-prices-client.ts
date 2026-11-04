import { apiFetch } from './api-client';

export interface StorePrice {
  id: number;
  product_id: number;
  store_name: string;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface StorePriceInput {
  store_name: string;
  price: number;
}

export function listDistinctStoreNames(): Promise<string[]> {
  return apiFetch<string[]>('/store-prices/distinct-names');
}

export function listStorePrices(productId: number): Promise<StorePrice[]> {
  return apiFetch<StorePrice[]>(`/products/${productId}/store-prices`);
}

export function createStorePrice(productId: number, input: StorePriceInput): Promise<StorePrice> {
  return apiFetch<StorePrice>(`/products/${productId}/store-prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateStorePrice(id: number, input: Partial<StorePriceInput>): Promise<StorePrice> {
  return apiFetch<StorePrice>(`/store-prices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteStorePrice(id: number): Promise<void> {
  return apiFetch<void>(`/store-prices/${id}`, { method: 'DELETE' });
}
