import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct } from '../../../../helpers.js';
import { pool } from '../../../../../src/shared/db.js';
import { resetDatabase } from '../../../../reset-db.js';

describe('GET /products/barcode/:code', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('round-trips a barcode with leading zeros exactly', async () => {
    const barcode = '0123456789012';
    await createProduct({
      name: 'Test Product',
      barcode,
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({ method: 'GET', url: `/products/barcode/${barcode}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().barcode).toBe(barcode);
  });

  it('returns 404 for an unknown barcode', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/barcode/00000000000000' });
    expect(response.statusCode).toBe(404);
  });
});
