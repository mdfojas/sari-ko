import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /products', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a product with store prices and resolves the selected price', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Coke 1.5L',
        store_prices: [
          { store_name: 'Puregold', price: 6000, selected: false },
          { store_name: 'SM Supermarket', price: 6500, selected: true },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Coke 1.5L');
    expect(body.original_price).toBe(6500);
    expect(body.selected_store_price_id).not.toBeNull();
  });

  it('rejects creating a product with no store prices', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: { name: 'No Prices' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects creating a product with no store price marked selected', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'No Selection',
        store_prices: [{ store_name: 'Puregold', price: 6000 }],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a store price of zero with a clean 400, not a database-constraint crash', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Doomed Product',
        store_prices: [{ store_name: 'Bad Store', price: 0, selected: true }],
      },
    });

    expect(response.statusCode).toBe(400);

    const { rows } = await pool.query(`SELECT * FROM products WHERE name = 'Doomed Product'`);
    expect(rows).toHaveLength(0);
  });

  it.each([
    ['a price over the INTEGER ceiling', { name: 'Pricey', store_prices: [{ store_name: 'A', price: 3_000_000_000, selected: true }] }],
    ['a non-integer price', { name: 'Fractional', store_prices: [{ store_name: 'A', price: 12.5, selected: true }] }],
    ['a null store-price entry', { name: 'Null Entry', store_prices: [null] }],
    ['store_prices that is not a list', { name: 'Not A List', store_prices: {} }],
    ['a numeric store name', { name: 'Numeric', store_prices: [{ store_name: 123, price: 100, selected: true }] }],
  ])('returns 400, not a 500, for %s', async (_label, payload) => {
    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/products', payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error');
    const { rows } = await pool.query(`SELECT 1 FROM products WHERE name = $1`, [payload.name]);
    expect(rows).toHaveLength(0);
  });

  it('stores blank barcodes as null, so two products without one never collide on the UNIQUE column', async () => {
    const make = (name: string) =>
      app.inject({
        headers: authHeaderFor('admin'),
        method: 'POST',
        url: '/products',
        payload: { name, barcode: '', store_prices: [{ store_name: 'A', price: 100, selected: true }] },
      });

    const first = await make('No Barcode One');
    const second = await make('No Barcode Two');

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().barcode).toBeNull();
    expect(second.json().barcode).toBeNull();
  });

  it('trims a barcode sent with surrounding spaces, so looking it up by the bare digits finds it', async () => {
    const created = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: { name: 'Spaced Barcode', barcode: ' 4800016642125 ', store_prices: [{ store_name: 'A', price: 100, selected: true }] },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().barcode).toBe('4800016642125');

    const found = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: '/products/barcode/4800016642125' });
    expect(found.statusCode).toBe(200);
    expect(found.json().name).toBe('Spaced Barcode');
  });

  it('accepts other_names: null on create, treating it as no aliases', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: { name: 'Null Aliases', other_names: null, store_prices: [{ store_name: 'A', price: 100, selected: true }] },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().other_names).toEqual([]);
  });

  it('rejects a NUL byte in the name with a 400 instead of a Postgres 500', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: { name: 'Bad\u0000Name', store_prices: [{ store_name: 'A', price: 100, selected: true }] },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects a store price with a blank store name', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: {
        name: 'No Store Name',
        store_prices: [{ store_name: '', price: 1000, selected: true }],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  describe('stores for the initial prices', () => {
    const create = (storePrices: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/products', payload: { name: 'P', sale_price: 1000, store_prices: storePrices } });
    const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);

    it('creates a store for each new name and reuses one that exists, ignoring case', async () => {
      await app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/stores', payload: { name: 'Puregold' } });

      const response = await create([{ store_name: ' puregold ', price: 900, selected: true }, { store_name: 'SM', price: 950 }]);

      expect(response.statusCode).toBe(201);
      expect(response.json().selected_store_name).toBe('Puregold');
      expect(await storeNames()).toEqual(['Puregold', 'SM']);
    });

    it('rejects an over-long store name and leaves no store behind', async () => {
      const response = await create([{ store_name: 'x'.repeat(101), price: 900, selected: true }]);
      expect(response.statusCode).toBe(400);
      expect(await storeNames()).toEqual([]);
    });
  });

  describe('one price per store', () => {
    const create = (storePrices: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/products', payload: { name: 'P', sale_price: 1000, store_prices: storePrices } });

    it('rejects two prices for the same store in one request (any case), and creates nothing', async () => {
      const response = await create([{ store_name: 'Puregold', price: 900, selected: true }, { store_name: ' puregold ', price: 950 }]);

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('A product can have only one price per store');
      const { rows } = await pool.query(`SELECT (SELECT COUNT(*)::int FROM products) AS products, (SELECT COUNT(*)::int FROM stores) AS stores`);
      expect(rows[0]).toEqual({ products: 0, stores: 0 });
    });
  });

  it('answers 400, not 500, when two store names differ for JavaScript but are one store for the database (dotted capital I)', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products',
      payload: { name: 'P', sale_price: 1000, store_prices: [{ store_name: '\u0130stanbul', price: 900, selected: true }, { store_name: 'istanbul', price: 950 }] },
    });
    expect(response.statusCode, response.body).toBe(400);
    expect(response.json().error).toBe('A product can have only one price per store');
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM products`);
    expect(rows[0].n).toBe(0);
  });
});
