import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /store-prices/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/store-prices/1' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/store-prices/1',
      headers: authHeaderFor('customer'),
    });
    expect(response.statusCode).toBe(403);
  });

  it('gets a single store price by its own id', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/store-prices/${product.selected_store_price_id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().store_name).toBe('Puregold');
  });

  it('returns 404 for an unknown store price id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/store-prices/999999',
      headers: authHeaderFor('admin'),
    });
    expect(response.statusCode).toBe(404);
  });
});
