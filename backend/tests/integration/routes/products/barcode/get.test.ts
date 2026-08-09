import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../../helpers.js';
import { pool } from '../../../../../src/shared/db.js';
import { resetDatabase } from '../../../../reset-db.js';

describe('GET /products/barcode/:code', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/barcode/0123456789012' });
    expect(response.statusCode).toBe(401);
  });

  it('round-trips a barcode with leading zeros exactly', async () => {
    const barcode = '0123456789012';
    await createProduct({
      name: 'Test Product',
      barcode,
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/barcode/${barcode}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().barcode).toBe(barcode);
  });

  it('returns 404 for an unknown barcode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/products/barcode/00000000000000',
      headers: authHeaderFor('admin'),
    });
    expect(response.statusCode).toBe(404);
  });

  it('omits store-price fields for a customer', async () => {
    const barcode = '0123456789012';
    await createProduct({
      name: 'Test Product',
      barcode,
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/barcode/${barcode}`,
      headers: authHeaderFor('customer'),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sale_price).toBeDefined();
    expect(body.selected_store_price_id).toBeUndefined();
    expect(body.original_price).toBeUndefined();
  });
});
