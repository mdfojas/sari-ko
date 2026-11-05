import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createStorePrice,
  deleteStorePrice,
  listDistinctStoreNames,
  listStorePrices,
  updateStorePrice,
} from '@/lib/store-prices-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

const sampleStorePrice = {
  id: 11,
  product_id: 1,
  store_name: 'Puregold',
  price: 1200,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('store-prices-client', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listDistinctStoreNames', () => {
    test('fetches GET /store-prices/distinct-names', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(['Puregold', 'SM Supermarket']);
      const result = await listDistinctStoreNames();
      expect(apiFetch).toHaveBeenCalledWith('/store-prices/distinct-names');
      expect(result).toEqual(['Puregold', 'SM Supermarket']);
    });
  });

  describe('listStorePrices', () => {
    test('fetches GET /products/:id/store-prices', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([sampleStorePrice]);
      const result = await listStorePrices(1);
      expect(apiFetch).toHaveBeenCalledWith('/products/1/store-prices');
      expect(result).toEqual([sampleStorePrice]);
    });
  });

  describe('createStorePrice', () => {
    test('POSTs the store name and price to /products/:id/store-prices', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(sampleStorePrice);
      await createStorePrice(1, { store_name: 'Puregold', price: 1200 });
      expect(apiFetch).toHaveBeenCalledWith('/products/1/store-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_name: 'Puregold', price: 1200 }),
      });
    });
  });

  describe('updateStorePrice', () => {
    test('PATCHes /store-prices/:id with only the supplied fields', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(sampleStorePrice);
      await updateStorePrice(11, { price: 1300 });
      expect(apiFetch).toHaveBeenCalledWith('/store-prices/11', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 1300 }),
      });
    });
  });

  describe('deleteStorePrice', () => {
    test('DELETEs /store-prices/:id', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      await deleteStorePrice(11);
      expect(apiFetch).toHaveBeenCalledWith('/store-prices/11', { method: 'DELETE' });
    });
  });
});
