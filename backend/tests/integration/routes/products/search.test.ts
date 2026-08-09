import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products/search', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('finds a product by a substring of an alias in other_names', async () => {
    await createProduct({
      name: 'Coca-Cola 1.5L',
      other_names: ['Coke 1.5L', 'Softdrinks'],
      store_prices: [{ store_name: 'Puregold', price: 6000, selected: true }],
    });

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: '/products/search?q=coke' });

    expect(response.statusCode).toBe(200);
    const results = response.json();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Coca-Cola 1.5L');
  });
});
