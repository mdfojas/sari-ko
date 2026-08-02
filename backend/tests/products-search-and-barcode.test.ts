import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/shared/db.js';
import { resetDatabase } from './reset-db.js';

const app = buildApp();

async function createProduct(payload: Record<string, unknown>) {
  const response = await app.inject({ method: 'POST', url: '/products', payload });
  return response.json();
}

describe('Products search and barcode lookup', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
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

    const response = await app.inject({ method: 'GET', url: '/products/search?q=coke' });

    expect(response.statusCode).toBe(200);
    const results = response.json();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Coca-Cola 1.5L');
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
      method: 'GET',
      url: '/products/barcode/00000000000000/store-prices',
    });
    expect(response.statusCode).toBe(404);
  });
});
