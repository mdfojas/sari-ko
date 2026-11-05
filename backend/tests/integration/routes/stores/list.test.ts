import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct, createStore } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /stores', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const get = (role: 'admin' | 'store_owner' | 'customer' | null = 'admin') =>
    app.inject({ method: 'GET', url: '/stores', ...(role ? { headers: authHeaderFor(role) } : {}) });

  it('rejects a request with no auth', async () => {
    expect((await get(null)).statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    expect((await get('customer')).statusCode).toBe(403);
  });

  it.each(['admin', 'store_owner'] as const)('is available to a %s', async (role) => {
    expect((await get(role)).statusCode).toBe(200);
  });

  it('returns an empty list when there are no stores', async () => {
    expect((await get()).json()).toEqual([]);
  });

  it('lists each store with its id, how many prices use it and how many products take their sale price from it', async () => {
    await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Puregold', price: 6500, selected: true }, { store_name: 'SM', price: 7000 }] });
    await createProduct({ name: 'Pancit', sale_price: 1500, store_prices: [{ store_name: 'Puregold', price: 1100, selected: true }] });
    await createProduct({ name: 'Tuna', sale_price: 3800, store_prices: [{ store_name: '7-Eleven', price: 2900, selected: true }] });

    const stores = (await get()).json();

    expect(stores).toEqual([
      { id: expect.any(Number), name: '7-Eleven', price_count: 1, selected_count: 1 },
      { id: expect.any(Number), name: 'Puregold', price_count: 2, selected_count: 2 },
      { id: expect.any(Number), name: 'SM', price_count: 1, selected_count: 0 },
    ]);
  });

  it('includes a store that has no prices yet', async () => {
    await createStore('Public Market');
    expect((await get()).json()).toEqual([{ id: expect.any(Number), name: 'Public Market', price_count: 0, selected_count: 0 }]);
  });

  it('a product has at most one price per store, so each store counts a product once', async () => {
    const product = await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Puregold', price: 6500, selected: true }] });
    const again = await app.inject({ method: 'POST', url: `/products/${product.id}/store-prices`, headers: authHeaderFor('admin'), payload: { store_name: 'Puregold', price: 6000 } });
    expect(again.statusCode).toBe(409);

    const [store] = (await get()).json();

    expect(store).toMatchObject({ name: 'Puregold', price_count: 1, selected_count: 1 });
  });

  it('orders stores case-insensitively', async () => {
    for (const name of ['sm', 'Puregold', '7-Eleven', 'S&R']) await createStore(name);
    expect((await get()).json().map((s: { name: string }) => s.name)).toEqual(['7-Eleven', 'Puregold', 'S&R', 'sm']);
  });
});
