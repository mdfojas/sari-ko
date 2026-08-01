import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/shared/db.js';
import { resetDatabase } from './reset-db.js';

const app = buildApp();

async function createProduct(payload: Record<string, unknown>) {
  const response = await app.inject({ method: 'POST', url: '/products', payload });
  return response.json();
}

describe('Store prices', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists, adds, gets, and edits a store price', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const addResponse = await app.inject({
      method: 'POST',
      url: `/products/${product.id}/store-prices`,
      payload: { store_name: 'SM Supermarket', price: 1200 },
    });
    expect(addResponse.statusCode).toBe(201);
    const added = addResponse.json();

    const listResponse = await app.inject({ method: 'GET', url: `/products/${product.id}/store-prices` });
    expect(listResponse.json()).toHaveLength(2);

    const getResponse = await app.inject({ method: 'GET', url: `/store-prices/${added.id}` });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().store_name).toBe('SM Supermarket');

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/store-prices/${added.id}`,
      payload: { price: 1300 },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().price).toBe(1300);

    // adding a store price should not change which one is selected
    const productAfter = await app.inject({ method: 'GET', url: `/products/${product.id}` });
    expect(productAfter.json().original_price).toBe(1000);
  });

  it('deletes a non-selected store price normally', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });
    const addResponse = await app.inject({
      method: 'POST',
      url: `/products/${product.id}/store-prices`,
      payload: { store_name: 'SM Supermarket', price: 1200 },
    });
    const nonSelected = addResponse.json();

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/store-prices/${nonSelected.id}` });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it('rejects deleting the currently-selected store price with a clear API error, not a raw DB error', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/store-prices/${product.selected_store_price_id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
    expect(deleteResponse.json().error).toMatch(/selected/i);
  });

  it('also rejects the same delete at the DB level directly, bypassing the API', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    await expect(
      pool.query(`DELETE FROM store_prices WHERE id = $1`, [product.selected_store_price_id]),
    ).rejects.toThrow();
  });
});
