import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /products/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it.each([
    ['a non-integer sale_price', { sale_price: 12.5 }],
    ['a zero sale_price', { sale_price: 0 }],
    ['a sale_price over the INTEGER ceiling', { sale_price: 3_000_000_000 }],
    ['a blanked-out name', { name: '   ' }],
    ['a non-list other_names', { other_names: 'tuna' }],
  ])('returns 400, not a raw database 500, for %s', async (_label, payload) => {
    const product = await createProduct({
      name: 'Editable',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/products/${product.id}`,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error');
  });

  it('returns 400 when there is no request body at all', async () => {
    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'PATCH', url: '/products/1' });
    expect(response.statusCode).toBe(400);
  });

  it('still saves a valid edit', async () => {
    const product = await createProduct({
      name: 'Editable',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/products/${product.id}`,
      payload: { name: 'Renamed', sale_price: 2125 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Renamed', sale_price: 2125 });
  });

  describe('selecting the sale-price source (selected_store_price_id) — what the Store Prices dashboard calls', () => {
    async function twoProducts() {
      const a = await createProduct({
        name: 'Product A',
        store_prices: [
          { store_name: 'Puregold', price: 1000, selected: true },
          { store_name: 'SM', price: 1100 },
        ],
      });
      const b = await createProduct({ name: 'Product B', store_prices: [{ store_name: 'S&R', price: 2000, selected: true }] });
      const pricesOf = async (id: number) =>
        (await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/products/${id}/store-prices` })).json() as {
          id: number;
          store_name: string;
        }[];
      return { a, b, aPrices: await pricesOf(a.id), bPrices: await pricesOf(b.id) };
    }
    const patch = (id: number, payload: unknown) =>
      app.inject({ headers: authHeaderFor('admin'), method: 'PATCH', url: `/products/${id}`, payload: payload as object });

    it("switches to another of the product's own store prices, and the product reflects it", async () => {
      const { a, aPrices } = await twoProducts();
      const sm = aPrices.find((p) => p.store_name === 'SM')!;

      const response = await patch(a.id, { selected_store_price_id: sm.id });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ selected_store_price_id: sm.id, selected_store_name: 'SM', original_price: 1100 });
    });

    it('returns 400, not a foreign-key 500, for a store price that does not exist', async () => {
      const { a } = await twoProducts();
      const response = await patch(a.id, { selected_store_price_id: 999999 });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/store price/i);
    });

    it("returns 400, and changes nothing, for another product's store price", async () => {
      const { a, bPrices } = await twoProducts();

      const response = await patch(a.id, { selected_store_price_id: bPrices[0].id });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/belong/i);
      const after = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/products/${a.id}` });
      expect(after.json().selected_store_price_id).toBe(a.selected_store_price_id);
    });

    it("is all-or-nothing: a rejected selection leaves the other fields in the same request unchanged", async () => {
      const { a, bPrices } = await twoProducts();

      const response = await patch(a.id, { name: 'Renamed Anyway', sale_price: 9999, selected_store_price_id: bPrices[0].id });

      expect(response.statusCode).toBe(400);
      const after = (await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/products/${a.id}` })).json();
      expect(after.name).toBe('Product A');
      expect(after.sale_price).toBe(a.sale_price);
      expect(after.selected_store_price_id).toBe(a.selected_store_price_id);
    });

    it('still returns 404 for a product that does not exist', async () => {
      const { bPrices } = await twoProducts();
      expect((await patch(999999, { name: 'Ghost' })).statusCode).toBe(404);
      expect((await patch(999999, { selected_store_price_id: bPrices[0].id })).statusCode).toBe(404);
    });
  });

  it('returns 400 "No updatable fields provided" for an empty JSON object', async () => {
    const product = await createProduct({ name: 'Editable', store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }] });
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/products/${product.id}`,
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'No updatable fields provided' });
  });

  it('stores a blank barcode as null rather than as an empty string', async () => {
    const product = await createProduct({
      name: 'Editable',
      barcode: '111',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/products/${product.id}`,
      payload: { barcode: '  ' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().barcode).toBeNull();
  });

  it('returns 409, not 500, when updating a barcode to one already in use', async () => {
    await createProduct({
      name: 'Product A',
      barcode: '0123456789012',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });
    const productB = await createProduct({
      name: 'Product B',
      store_prices: [{ store_name: 'Puregold', price: 2000, selected: true }],
    });

    const patchResponse = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/products/${productB.id}`,
      payload: { barcode: '0123456789012' },
    });

    expect(patchResponse.statusCode).toBe(409);
  });
});
