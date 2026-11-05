import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct, createStore } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /stores/:id/merge (move a store into another)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const merge = (id: number | string, payload?: unknown, role: 'admin' | 'store_owner' | 'customer' | null = 'admin') =>
    app.inject({
      method: 'POST',
      url: `/stores/${id}/merge`,
      ...(role ? { headers: authHeaderFor(role) } : {}),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);

  // Coke and Pancit are priced at the typo store; Tuna is priced at the real one.
  async function typoAndReal() {
    await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Puregld', price: 6500, selected: true }] });
    await createProduct({ name: 'Pancit', sale_price: 1500, store_prices: [{ store_name: 'Puregld', price: 1100, selected: true }] });
    await createProduct({ name: 'Tuna', sale_price: 3800, store_prices: [{ store_name: 'Puregold', price: 2900, selected: true }] });
    const ids = Object.fromEntries((await pool.query(`SELECT id, name FROM stores`)).rows.map((r) => [r.name, r.id]));
    return { typo: ids['Puregld'] as number, real: ids['Puregold'] as number };
  }

  it('rejects a request with no auth', async () => {
    expect((await merge(1, { into: 2 }, null)).statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    expect((await merge(1, { into: 2 }, 'customer')).statusCode).toBe(403);
  });

  it.each(['admin', 'store_owner'] as const)('is available to a %s', async (role) => {
    const { typo, real } = await typoAndReal();
    expect((await merge(typo, { into: real }, role)).statusCode).toBe(200);
  });

  it('moves every price to the other store, reports how many, and removes the merged store', async () => {
    const { typo, real } = await typoAndReal();

    const response = await merge(typo, { into: real });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ moved: 2 });
    expect(await storeNames()).toEqual(['Puregold']);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM store_prices WHERE store_id = $1`, [real]);
    expect(rows[0].n).toBe(3);
  });

  it('keeps each product\'s sale price source, which now shows the surviving name', async () => {
    const { typo, real } = await typoAndReal();
    await merge(typo, { into: real });

    const coke = (await app.inject({ method: 'GET', url: '/products/search?q=coke', headers: authHeaderFor('admin') })).json()[0];

    expect(coke.selected_store_name).toBe('Puregold');
    expect(coke.original_price).toBe(6500);
    expect(coke.sale_price).toBe(8500);
  });

  it('merges a store that has no prices', async () => {
    const empty = await createStore('Empty');
    const real = await createStore('Real');
    expect((await merge(empty.id, { into: real.id })).json()).toEqual({ moved: 0 });
    expect(await storeNames()).toEqual(['Real']);
  });

  it('refuses a merge that would give one product two prices at the same store, and changes nothing', async () => {
    const { typo, real } = await typoAndReal();
    const { rows } = await pool.query(`SELECT id FROM products WHERE name = 'Coke'`);
    await pool.query(`INSERT INTO store_prices (product_id, store_id, price) VALUES ($1, $2, 6000)`, [rows[0].id, real]);

    const response = await merge(typo, { into: real });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/1 product already has a price at "Puregold"/);
    expect(await storeNames()).toEqual(['Puregld', 'Puregold']);
  });

  it('refuses to merge a store into itself', async () => {
    const store = await createStore('Puregold');
    const response = await merge(store.id, { into: store.id });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'A store cannot be merged into itself' });
    expect(await storeNames()).toEqual(['Puregold']);
  });

  it('returns 404 when either store does not exist', async () => {
    const store = await createStore('Puregold');
    expect((await merge(999999, { into: store.id })).statusCode).toBe(404);
    expect((await merge(store.id, { into: 999999 })).statusCode).toBe(404);
    expect(await storeNames()).toEqual(['Puregold']);
  });

  it('returns 404 for a second identical merge (the first store is gone)', async () => {
    const { typo, real } = await typoAndReal();
    await merge(typo, { into: real });
    expect((await merge(typo, { into: real })).statusCode).toBe(404);
  });

  it.each([
    ['no body', undefined],
    ['a missing target', {}],
    ['a text target', { into: '2' }],
    ['a zero target', { into: 0 }],
    ['a huge target', { into: 3_000_000_000 }],
  ])('returns 400, not a 500, for %s', async (_label, payload) => {
    const store = await createStore('Puregold');
    expect((await merge(store.id, payload)).statusCode).toBe(400);
  });

  it.each(['abc', '0', '3000000000'])('returns 400 for the id %s', async (id) => {
    expect((await merge(id, { into: 2 })).statusCode).toBe(400);
  });
});
