import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products/:id/store-prices', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists all store prices for a product', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [
        { store_name: 'Puregold', price: 1000, selected: true },
        { store_name: 'SM Supermarket', price: 1200 },
      ],
    });

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'GET',
      url: `/products/${product.id}/store-prices`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });
});
