import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists all products', async () => {
    await createProduct({
      name: 'Listed Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const listResponse = await app.inject({ method: 'GET', url: '/products' });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
  });
});
