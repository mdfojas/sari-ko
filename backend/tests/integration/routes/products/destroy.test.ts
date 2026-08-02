import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /products/:id', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('deletes a product', async () => {
    const product = await createProduct({
      name: 'Deletable Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/products/${product.id}` });
    expect(deleteResponse.statusCode).toBe(204);

    const getAfterDelete = await app.inject({ method: 'GET', url: `/products/${product.id}` });
    expect(getAfterDelete.statusCode).toBe(404);
  });

  it('returns 404 when deleting an unknown product id', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/products/999999' });
    expect(response.statusCode).toBe(404);
  });
});
