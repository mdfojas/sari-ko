import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('gets a single product', async () => {
    const product = await createProduct({
      name: 'Fetchable Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({ method: 'GET', url: `/products/${product.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Fetchable Product');
  });

  it('returns 404 for an unknown product id', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/999999' });
    expect(response.statusCode).toBe(404);
  });
});
