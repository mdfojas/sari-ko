import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /store-prices/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('gets a single store price by its own id', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/store-prices/${product.selected_store_price_id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().store_name).toBe('Puregold');
  });

  it('returns 404 for an unknown store price id', async () => {
    const response = await app.inject({ method: 'GET', url: '/store-prices/999999' });
    expect(response.statusCode).toBe(404);
  });
});
