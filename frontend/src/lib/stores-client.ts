import { apiFetch } from './api-client';

export interface StoreSummary {
  id: number;
  name: string;
  // How many store prices use this store, across all products. Zero for a store that was
  // added but has no price yet.
  price_count: number;
  // How many products take their sale price from a price at this store.
  selected_count: number;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function listStores(): Promise<StoreSummary[]> {
  return apiFetch<StoreSummary[]>('/stores');
}

// The price each product has at one store (id = the store price's own id). Used to filter
// the Store Prices list down to the products priced at a store.
export function listPricesAtStore(id: number): Promise<{ id: number; product_id: number; price: number }[]> {
  return apiFetch<{ id: number; product_id: number; price: number }[]>(`/stores/${id}/store-prices`);
}

export function createStore(name: string): Promise<{ id: number; name: string }> {
  return apiFetch<{ id: number; name: string }>('/stores', json('POST', { name }));
}

export function renameStore(id: number, name: string): Promise<{ id: number; name: string }> {
  return apiFetch<{ id: number; name: string }>(`/stores/${id}`, json('PATCH', { name }));
}

// Moves every price at this store to another store, then removes this store.
export function mergeStore(id: number, into: number): Promise<{ moved: number }> {
  return apiFetch<{ moved: number }>(`/stores/${id}/merge`, json('POST', { into }));
}

// Deletes the store and every price at it. The backend refuses while any product still
// takes its sale price from it.
export function deleteStore(id: number): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>(`/stores/${id}`, { method: 'DELETE' });
}
