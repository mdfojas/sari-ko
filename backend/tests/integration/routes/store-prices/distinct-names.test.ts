import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /store-prices/distinct-names', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/store-prices/distinct-names' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/store-prices/distinct-names',
      headers: authHeaderFor('customer'),
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns an empty list when there are no store prices yet', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/store-prices/distinct-names',
      headers: authHeaderFor('admin'),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('returns distinct, alphabetically sorted store names across every product', async () => {
    await createProduct({
      name: 'Product A',
      store_prices: [
        { store_name: 'SM Supermarket', price: 1000, selected: true },
        { store_name: 'Puregold', price: 900, selected: false },
      ],
    });
    await createProduct({
      name: 'Product B',
      // Same store name reused across a different product — must not duplicate.
      store_prices: [{ store_name: 'Puregold', price: 500, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/store-prices/distinct-names',
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(['Puregold', 'SM Supermarket']);
  });
});
