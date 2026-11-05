import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct, createStore } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /stores/:id (remove a store and its prices)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const del = (id: number | string, role: 'admin' | 'store_owner' | 'customer' | null = 'admin') =>
    app.inject({ method: 'DELETE', url: `/stores/${id}`, ...(role ? { headers: authHeaderFor(role) } : {}) });
  const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);
  const idOf = async (name: string) => (await pool.query(`SELECT id FROM stores WHERE name = $1`, [name])).rows[0].id as number;

  // Coke's sale source is Puregold; Tuna's is Local. S&R and SM are nobody's source.
  async function seed() {
    await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Puregold', price: 6500, selected: true }, { store_name: 'SM', price: 7000 }] });
    await createProduct({ name: 'Tuna', sale_price: 3800, store_prices: [{ store_name: 'Local', price: 2800, selected: true }, { store_name: 'S&R', price: 2900 }, { store_name: 'SM', price: 3000 }] });
  }

  it('rejects a request with no auth', async () => {
    expect((await del(1, null)).statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    expect((await del(1, 'customer')).statusCode).toBe(403);
  });

  it.each(['admin', 'store_owner'] as const)('is available to a %s', async (role) => {
    await seed();
    expect((await del(await idOf('S&R'), role)).statusCode).toBe(200);
  });

  it('deletes the store and every price at it, reporting how many prices went, and nothing else', async () => {
    await seed();

    const response = await del(await idOf('SM'));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: 2 });
    expect(await storeNames()).toEqual(['Local', 'Puregold', 'S&R']);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM store_prices`);
    expect(rows[0].n).toBe(3);
  });

  it('deletes a store that has no prices', async () => {
    const empty = await createStore('Empty');
    const response = await del(empty.id);
    expect(response.json()).toEqual({ deleted: 0 });
    expect(await storeNames()).toEqual([]);
  });

  it('refuses to delete a store that is the sale price source of a product, naming how many, and deletes nothing', async () => {
    await seed();

    const response = await del(await idOf('Puregold'));

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/"Puregold" is the sale-price source for 1 product/);
    expect(await storeNames()).toEqual(['Local', 'Puregold', 'S&R', 'SM']);
  });

  it('counts every product that relies on the store in the refusal', async () => {
    for (const name of ['A', 'B', 'C']) {
      await createProduct({ name, sale_price: 100, store_prices: [{ store_name: 'Puregold', price: 50, selected: true }] });
    }
    const response = await del(await idOf('Puregold'));
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/3 products/);
  });

  it('can delete the store once no product uses it as its source', async () => {
    await seed();
    await pool.query(`UPDATE products SET selected_store_price_id = NULL`);
    expect((await del(await idOf('Puregold'))).statusCode).toBe(200);
  });

  it('returns 404 for a store that does not exist, and for a second identical request', async () => {
    await seed();
    expect((await del(999999)).statusCode).toBe(404);
    const id = await idOf('SM');
    await del(id);
    expect((await del(id)).statusCode).toBe(404);
  });

  it.each(['abc', '0', '-1', '3000000000'])('returns 400 for the id %s', async (id) => {
    expect((await del(id)).statusCode).toBe(400);
  });
});
