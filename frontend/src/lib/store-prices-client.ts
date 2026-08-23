import { apiFetch } from './api-client';

export function listDistinctStoreNames(): Promise<string[]> {
  return apiFetch<string[]>('/store-prices/distinct-names');
}
