import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /store-prices/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('edits a store price', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const patchResponse = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/store-prices/${product.selected_store_price_id}`,
      payload: { price: 1300 },
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().price).toBe(1300);
  });

  it('returns 400 when no updatable fields are provided', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/store-prices/${product.selected_store_price_id}`,
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  describe('changing the store of a price', () => {
    const patch = (id: number, payload: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'PATCH', url: `/store-prices/${id}`, payload: payload as object });
    const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);

    it('moves the price to another existing store, ignoring case, and returns the canonical name', async () => {
      await createProduct({ name: 'Other', store_prices: [{ store_name: 'Puregold', price: 900, selected: true }] });
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'SM', price: 1200, selected: true }] });

      const response = await patch(product.selected_store_price_id, { store_name: ' puregold ' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ store_name: 'Puregold', price: 1200 });
      expect(await storeNames()).toEqual(['Puregold', 'SM']);
    });

    it('creates the store when the new name is not known yet', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });

      const response = await patch(product.selected_store_price_id, { store_name: 'Public Market' });

      expect(response.json().store_name).toBe('Public Market');
      expect(await storeNames()).toEqual(['Public Market', 'Puregold']);
    });

    it('a product whose selected price changes store shows the new store as its sale source', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      await patch(product.selected_store_price_id, { store_name: 'Public Market' });

      const after = (await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/products/${product.id}` })).json();

      expect(after.selected_store_name).toBe('Public Market');
    });

    it('can change the price alone, leaving the store as it is', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      const response = await patch(product.selected_store_price_id, { price: 1100 });
      expect(response.json()).toMatchObject({ store_name: 'Puregold', price: 1100 });
    });

    it.each([
      ['a price of 0', { price: 0 }],
      ['a fractional price', { price: 1.5 }],
      ['a price over the ceiling', { price: 3_000_000_000 }],
      ['a blank store name', { store_name: '   ' }],
      ['a numeric store name', { store_name: 5 }],
      ['an over-long store name', { store_name: 'x'.repeat(5000) }],
    ])('returns 400, not a 500, for %s, and changes nothing', async (_label, payload) => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      expect((await patch(product.selected_store_price_id, payload)).statusCode).toBe(400);
      const { rows } = await pool.query(`SELECT price FROM store_prices WHERE id = $1`, [product.selected_store_price_id]);
      expect(rows[0].price).toBe(1000);
      expect(await storeNames()).toEqual(['Puregold']);
    });

    it('does not leave a new store behind when the price does not exist', async () => {
      expect((await patch(999999, { store_name: 'Ghost Store' })).statusCode).toBe(404);
      expect(await storeNames()).toEqual([]);
    });
  });

  describe('one price per product and store', () => {
    const patch = (id: number, payload: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'PATCH', url: `/store-prices/${id}`, payload: payload as object });

    it('refuses moving a price to a store the product already has a price at, and changes nothing', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }, { store_name: 'SM', price: 1200 }] });
      const { rows } = await pool.query(`SELECT sp.id FROM store_prices sp JOIN stores s ON s.id = sp.store_id WHERE s.name = 'SM' AND sp.product_id = $1`, [product.id]);

      const response = await patch(rows[0].id, { store_name: 'puregold' });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('This product already has a price at "Puregold". Edit that price instead.');
      const { rows: after } = await pool.query(`SELECT s.name FROM store_prices sp JOIN stores s ON s.id = sp.store_id WHERE sp.id = $1`, [rows[0].id]);
      expect(after[0].name).toBe('SM');
    });

    it('still allows renaming a price\'s store to a different case of the store it is already at', async () => {
      const product = await createProduct({ name: 'P', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
      const response = await patch(product.selected_store_price_id, { store_name: 'PUREGOLD' });
      expect(response.statusCode).toBe(200);
      expect(response.json().store_name).toBe('Puregold');
    });
  });
});
