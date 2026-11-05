import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /products/:id/store-prices', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('adds a new store price without changing which one is selected', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const addResponse = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/products/${product.id}/store-prices`,
      payload: { store_name: 'SM Supermarket', price: 1200 },
    });

    expect(addResponse.statusCode).toBe(201);
    expect(addResponse.json().store_name).toBe('SM Supermarket');

    const productAfter = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/products/${product.id}` });
    expect(productAfter.json().original_price).toBe(1000);
  });

  it('returns 404 when the product does not exist', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/products/999999/store-prices',
      payload: { store_name: 'Puregold', price: 1000 },
    });
    expect(response.statusCode).toBe(404);
  });

  describe('stores', () => {
    const post = (productId: number, payload: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: `/products/${productId}/store-prices`, payload: payload as object });
    const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);

    it('creates the store when the name is new, and returns its id and name', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });

      const response = await post(product.id, { store_name: 'Public Market', price: 900 });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ store_id: expect.any(Number), store_name: 'Public Market', price: 900 });
      expect(await storeNames()).toEqual(['Public Market', 'Puregold']);
    });

    it('reuses an existing store, ignoring case and surrounding spaces, so no look-alike store appears', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      const other = await createProduct({ name: 'Q', store_prices: [{ store_name: 'SM', price: 1000, selected: true }] });

      const response = await post(other.id, { store_name: '  puregold ', price: 900 });

      expect(response.statusCode).toBe(201);
      expect(response.json().store_name).toBe('Puregold');
      expect(await storeNames()).toEqual(['Puregold', 'SM']);
      void product;
    });

    it('uses a store that was added first, with no price yet', async () => {
      await app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/stores', payload: { name: 'Public Market' } });
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });

      const response = await post(product.id, { store_name: 'public market', price: 900 });

      expect(response.json().store_name).toBe('Public Market');
      expect(await storeNames()).toEqual(['Public Market', 'Puregold']);
    });

    it('does not leave a new store behind when the product does not exist', async () => {
      const response = await post(999999, { store_name: 'Ghost Store', price: 900 });
      expect(response.statusCode).toBe(404);
      expect(await storeNames()).toEqual([]);
    });

    it.each([
      ['a price of 0', { store_name: 'Puregold', price: 0 }],
      ['a negative price', { store_name: 'Puregold', price: -5 }],
      ['a fractional price', { store_name: 'Puregold', price: 12.5 }],
      ['a price over the INTEGER ceiling', { store_name: 'Puregold', price: 3_000_000_000 }],
      ['a numeric store name', { store_name: 5, price: 100 }],
      ['an over-long store name', { store_name: 'x'.repeat(5000), price: 100 }],
      ['a NUL byte in the name', { store_name: 'a\u0000b', price: 100 }],
    ])('returns 400, not a 500, for %s, and creates no store', async (_label, payload) => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      expect((await post(product.id, payload)).statusCode).toBe(400);
      expect(await storeNames()).toEqual(['Puregold']);
    });
  });

  describe('one price per product and store', () => {
    const post = (productId: number, payload: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: `/products/${productId}/store-prices`, payload: payload as object });

    it('refuses a second price for the same store, naming the store, and keeps the first', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });

      const response = await post(product.id, { store_name: 'Puregold', price: 900 });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('This product already has a price at "Puregold". Edit that price instead.');
      const { rows } = await pool.query(`SELECT price FROM store_prices WHERE product_id = $1`, [product.id]);
      expect(rows).toEqual([{ price: 1000 }]);
    });

    it('treats a different case or surrounding spaces as the same store', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      for (const store_name of ['puregold', '  PUREGOLD ']) {
        expect((await post(product.id, { store_name, price: 900 })).statusCode).toBe(409);
      }
    });

    it('lets two different products each have a price at the same store', async () => {
      const a = await createProduct({ name: 'A', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      const b = await createProduct({ name: 'B', store_prices: [{ store_name: 'SM', price: 1000, selected: true }] });
      expect((await post(b.id, { store_name: 'Puregold', price: 900 })).statusCode).toBe(201);
      void a;
    });

    it('answers 404 (not 409) when the product was deleted at the moment the price was saved', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      const other = await pool.connect();
      try {
        await other.query('BEGIN');
        await other.query(`DELETE FROM products WHERE id = $1`, [product.id]);
        const pending = post(product.id, { store_name: 'SM', price: 900 });
        await new Promise((resolve) => setTimeout(resolve, 300));
        await other.query('COMMIT');

        const response = await pending;
        expect(response.statusCode, response.body).toBe(404);
        expect(response.json()).toEqual({ error: 'Product not found' });
      } finally {
        other.release();
      }
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM stores WHERE name = 'SM'`);
      expect(rows[0].n).toBe(0);
    });

    it('answers 409 (try again) when the store was deleted at the moment the price was saved', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      await app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/stores', payload: { name: 'Target' } });
      const { rows: target } = await pool.query(`SELECT id FROM stores WHERE name = 'Target'`);
      const other = await pool.connect();
      try {
        await other.query('BEGIN');
        await other.query(`DELETE FROM stores WHERE id = $1`, [target[0].id]);
        const pending = post(product.id, { store_name: 'Target', price: 900 });
        await new Promise((resolve) => setTimeout(resolve, 300));
        await other.query('COMMIT');

        const response = await pending;
        expect(response.statusCode, response.body).toBe(409);
        expect(response.json().error).toBe('That store was just changed. Please try again.');
      } finally {
        other.release();
      }
    });
  });
});
