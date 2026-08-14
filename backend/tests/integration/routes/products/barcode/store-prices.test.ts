import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../../helpers.js';
import { pool } from '../../../../../src/shared/db.js';
import { resetDatabase } from '../../../../reset-db.js';

describe('GET /products/barcode/:code/store-prices', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns all store prices (not just the selected one) for a barcode', async () => {
    const product = await createProduct({
      name: 'Multi-store Product',
      barcode: '9999999999999',
      store_prices: [
        { store_name: 'Puregold', price: 5000, selected: true },
        { store_name: 'SM Supermarket', price: 5500, selected: false },
        { store_name: '7-Eleven', price: 6000, selected: false },
      ],
    });

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'GET',
      url: '/products/barcode/9999999999999/store-prices',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.product).toEqual({ id: product.id, name: 'Multi-store Product' });
    expect(body.store_prices).toHaveLength(3);
  });

  it('returns 404 from the store-prices barcode lookup for an unknown barcode', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'GET',
      url: '/products/barcode/00000000000000/store-prices',
    });
    expect(response.statusCode).toBe(404);
  });
});
