import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct, createStore } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /stores/:id/store-prices (the prices at one store)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const get = (id: number | string, role: 'admin' | 'store_owner' | 'customer' | null = 'admin') =>
    app.inject({ method: 'GET', url: `/stores/${id}/store-prices`, ...(role ? { headers: authHeaderFor(role) } : {}) });
  const idOf = async (name: string) => (await pool.query(`SELECT id FROM stores WHERE name = $1`, [name])).rows[0].id as number;

  async function seed() {
    const coke = await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Puregold', price: 6500, selected: true }, { store_name: 'SM', price: 7000 }] });
    const pancit = await createProduct({ name: 'Pancit', sale_price: 1500, store_prices: [{ store_name: 'Puregold', price: 1100, selected: true }] });
    const tuna = await createProduct({ name: 'Tuna', sale_price: 3800, store_prices: [{ store_name: '7-Eleven', price: 2900, selected: true }] });
    return { coke, pancit, tuna };
  }

  it('rejects a request with no auth', async () => {
    expect((await get(1, null)).statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    expect((await get(1, 'customer')).statusCode).toBe(403);
  });

  it.each(['admin', 'store_owner'] as const)('is available to a %s', async (role) => {
    await seed();
    expect((await get(await idOf('Puregold'), role)).statusCode).toBe(200);
  });

  it('lists the price at that store for each product, and only those', async () => {
    const { coke, pancit } = await seed();

    const response = await get(await idOf('Puregold'));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: expect.any(Number), product_id: coke.id, price: 6500 },
      { id: expect.any(Number), product_id: pancit.id, price: 1100 },
    ]);
  });

  it('does not include prices at other stores', async () => {
    const { coke } = await seed();
    expect((await get(await idOf('SM'))).json()).toEqual([{ id: expect.any(Number), product_id: coke.id, price: 7000 }]);
  });

  it('returns an empty list for a store that has no prices', async () => {
    const empty = await createStore('Empty');
    const response = await get(empty.id);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns 404 for a store that does not exist', async () => {
    const response = await get(999999);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Store not found' });
  });

  it.each(['abc', '0', '-1', '3000000000'])('returns 400 for the id %s', async (id) => {
    expect((await get(id)).statusCode).toBe(400);
  });
});
