import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct, createStore } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /stores/:id (rename one store)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const patch = (id: number | string, payload?: unknown, role: 'admin' | 'store_owner' | 'customer' | null = 'admin') =>
    app.inject({
      method: 'PATCH',
      url: `/stores/${id}`,
      ...(role ? { headers: authHeaderFor(role) } : {}),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);

  it('rejects a request with no auth', async () => {
    expect((await patch(1, { name: 'x' }, null)).statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    expect((await patch(1, { name: 'x' }, 'customer')).statusCode).toBe(403);
  });

  it.each(['admin', 'store_owner'] as const)('is available to a %s', async (role) => {
    const store = await createStore('Puregld');
    expect((await patch(store.id, { name: 'Puregold' }, role)).statusCode).toBe(200);
  });

  it('renames the store once, and every price at it shows the new name', async () => {
    await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Puregld', price: 6500, selected: true }] });
    await createProduct({ name: 'Pancit', sale_price: 1500, store_prices: [{ store_name: 'Puregld', price: 1100, selected: true }] });
    const [{ id }] = (await pool.query(`SELECT id FROM stores`)).rows;

    const response = await patch(id, { name: 'Puregold' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id, name: 'Puregold' });
    expect(await storeNames()).toEqual(['Puregold']);
    const coke = (await app.inject({ method: 'GET', url: '/products/search?q=coke', headers: authHeaderFor('admin') })).json()[0];
    expect(coke.selected_store_name).toBe('Puregold');
    expect(coke.original_price).toBe(6500);
  });

  it('bumps updated_at on the store', async () => {
    const store = await createStore('Puregld');
    await pool.query(`UPDATE stores SET updated_at = '2020-01-01'`);
    await patch(store.id, { name: 'Puregold' });
    const { rows } = await pool.query(`SELECT updated_at > '2021-01-01' AS touched FROM stores`);
    expect(rows[0].touched).toBe(true);
  });

  it('trims the new name', async () => {
    const store = await createStore('Puregld');
    expect((await patch(store.id, { name: '  Puregold  ' })).json().name).toBe('Puregold');
  });

  it('allows a change of case only', async () => {
    const store = await createStore('puregold');
    expect((await patch(store.id, { name: 'Puregold' })).statusCode).toBe(200);
    expect(await storeNames()).toEqual(['Puregold']);
  });

  it('renaming a store to the name it already has is a harmless no-op', async () => {
    const store = await createStore('Puregold');
    const response = await patch(store.id, { name: 'Puregold' });
    expect(response.statusCode).toBe(200);
    expect(await storeNames()).toEqual(['Puregold']);
  });

  it('refuses a name that belongs to a different store (ignoring case), pointing at merge, and changes nothing', async () => {
    const typo = await createStore('Puregld');
    await createStore('Puregold');

    for (const name of ['Puregold', 'puregold', ' PUREGOLD ']) {
      const response = await patch(typo.id, { name });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('A store called "Puregold" already exists. Merge the two stores instead.');
    }
    expect(await storeNames()).toEqual(['Puregld', 'Puregold']);
  });

  it('returns 404 for a store that does not exist', async () => {
    const response = await patch(999999, { name: 'x' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Store not found' });
  });

  it.each(['abc', '0', '-1', '3000000000'])('returns 400 for the id %s', async (id) => {
    expect((await patch(id, { name: 'x' })).statusCode).toBe(400);
  });

  it.each([
    ['no body', undefined],
    ['a missing name', {}],
    ['a numeric name', { name: 5 }],
    ['a blank name', { name: '   ' }],
    ['an over-long name', { name: 'x'.repeat(5000) }],
    ['a NUL byte', { name: 'a\u0000b' }],
  ])('returns 400, not a 500, for %s, and changes nothing', async (_label, payload) => {
    const store = await createStore('Puregld');
    expect((await patch(store.id, payload)).statusCode).toBe(400);
    expect(await storeNames()).toEqual(['Puregld']);
  });
});
