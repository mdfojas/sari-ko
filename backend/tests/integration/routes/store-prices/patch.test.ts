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
});
