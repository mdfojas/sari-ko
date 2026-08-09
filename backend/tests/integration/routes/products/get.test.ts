import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/1' });
    expect(response.statusCode).toBe(401);
  });

  it('gets a single product', async () => {
    const product = await createProduct({
      name: 'Fetchable Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Fetchable Product');
  });

  it('returns 404 for an unknown product id', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/999999', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(404);
  });

  it('omits store-price fields for a customer, keeping sale_price', async () => {
    const product = await createProduct({
      name: 'Fetchable Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}`,
      headers: authHeaderFor('customer'),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sale_price).toBeDefined();
    expect(body.selected_store_price_id).toBeUndefined();
    expect(body.original_price).toBeUndefined();
  });
});
