import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /products/:id', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns 409, not 500, when updating a barcode to one already in use', async () => {
    await createProduct({
      name: 'Product A',
      barcode: '0123456789012',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });
    const productB = await createProduct({
      name: 'Product B',
      store_prices: [{ store_name: 'Puregold', price: 2000, selected: true }],
    });

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/products/${productB.id}`,
      payload: { barcode: '0123456789012' },
    });

    expect(patchResponse.statusCode).toBe(409);
  });
});
