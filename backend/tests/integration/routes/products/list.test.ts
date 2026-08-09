import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/products' });
    expect(response.statusCode).toBe(401);
  });

  it('lists all products', async () => {
    await createProduct({
      name: 'Listed Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const listResponse = await app.inject({ method: 'GET', url: '/products', headers: authHeaderFor('admin') });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
  });

  it('omits store-price fields for a customer', async () => {
    await createProduct({
      name: 'Listed Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const listResponse = await app.inject({ method: 'GET', url: '/products', headers: authHeaderFor('customer') });

    expect(listResponse.statusCode).toBe(200);
    const body = listResponse.json();
    expect(body[0].sale_price).toBeDefined();
    expect(body[0].selected_store_price_id).toBeUndefined();
    expect(body[0].original_price).toBeUndefined();
  });
});
