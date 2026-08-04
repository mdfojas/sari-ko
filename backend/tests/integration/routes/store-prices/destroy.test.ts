import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /store-prices/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('deletes a non-selected store price normally', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });
    const addResponse = await app.inject({
      method: 'POST',
      url: `/products/${product.id}/store-prices`,
      payload: { store_name: 'SM Supermarket', price: 1200 },
    });
    const nonSelected = addResponse.json();

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/store-prices/${nonSelected.id}` });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it('rejects deleting the currently-selected store price with a clear API error, not a raw DB error', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/store-prices/${product.selected_store_price_id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
    expect(deleteResponse.json().error).toMatch(/selected/i);
  });

  it('also rejects the same delete at the DB level directly, bypassing the API', async () => {
    const product = await createProduct({
      name: 'Test Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    await expect(
      pool.query(`DELETE FROM store_prices WHERE id = $1`, [product.selected_store_price_id]),
    ).rejects.toThrow();
  });
});
