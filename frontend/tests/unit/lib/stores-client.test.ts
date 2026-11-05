import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore, deleteStore, listPricesAtStore, listStores, mergeStore, renameStore } from '@/lib/stores-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('stores-client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('listStores reads GET /stores', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listStores();
    expect(apiFetch).toHaveBeenCalledWith('/stores');
  });

  test('listPricesAtStore reads GET /stores/:id/store-prices', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 5, product_id: 2, price: 1100 }]);
    expect(await listPricesAtStore(3)).toEqual([{ id: 5, product_id: 2, price: 1100 }]);
    expect(apiFetch).toHaveBeenCalledWith('/stores/3/store-prices');
  });

  test('createStore POSTs the name to /stores', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 7, name: 'Public Market' });
    expect(await createStore('Public Market')).toEqual({ id: 7, name: 'Public Market' });
    expect(apiFetch).toHaveBeenCalledWith('/stores', json('POST', { name: 'Public Market' }));
  });

  test('renameStore PATCHes /stores/:id with the new name', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 3, name: 'Puregold' });
    await renameStore(3, 'Puregold');
    expect(apiFetch).toHaveBeenCalledWith('/stores/3', json('PATCH', { name: 'Puregold' }));
  });

  test('mergeStore POSTs the target id to /stores/:id/merge and returns how many prices moved', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ moved: 12 });
    expect(await mergeStore(3, 5)).toEqual({ moved: 12 });
    expect(apiFetch).toHaveBeenCalledWith('/stores/3/merge', json('POST', { into: 5 }));
  });

  test('deleteStore DELETEs /stores/:id and returns how many prices went with it', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ deleted: 2 });
    expect(await deleteStore(4)).toEqual({ deleted: 2 });
    expect(apiFetch).toHaveBeenCalledWith('/stores/4', { method: 'DELETE' });
  });
});
