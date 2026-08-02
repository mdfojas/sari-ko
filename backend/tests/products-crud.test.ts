import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/shared/db.js';
import { resetDatabase } from './reset-db.js';

const app = buildApp();

describe('Products CRUD', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a product with store prices and resolves the selected price', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Coke 1.5L',
        store_prices: [
          { store_name: 'Puregold', price: 6000, selected: false },
          { store_name: 'SM Supermarket', price: 6500, selected: true },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Coke 1.5L');
    expect(body.original_price).toBe(6500);
    expect(body.selected_store_price_id).not.toBeNull();
  });

  it('rejects creating a product with no store prices', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/products',
      payload: { name: 'No Prices' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects creating a product with no store price marked selected', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        name: 'No Selection',
        store_prices: [{ store_name: 'Puregold', price: 6000 }],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('leaves no product row behind if the creation transaction fails partway', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Doomed Product',
        store_prices: [{ store_name: 'Bad Store', price: 0, selected: true }],
      },
    });

    expect(response.statusCode).toBe(500);

    const { rows } = await pool.query(`SELECT * FROM products WHERE name = 'Doomed Product'`);
    expect(rows).toHaveLength(0);
  });

  it('returns 409, not 500, when updating a barcode to one already in use', async () => {
    await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Product A',
        barcode: '0123456789012',
        store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
      },
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Product B',
        store_prices: [{ store_name: 'Puregold', price: 2000, selected: true }],
      },
    });
    const productB = secondResponse.json();

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/products/${productB.id}`,
      payload: { barcode: '0123456789012' },
    });

    expect(patchResponse.statusCode).toBe(409);
  });

  it('gets, lists, and deletes a product', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/products',
      payload: {
        name: 'Deletable Product',
        store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
      },
    });
    const product = createResponse.json();

    const getResponse = await app.inject({ method: 'GET', url: `/products/${product.id}` });
    expect(getResponse.statusCode).toBe(200);

    const listResponse = await app.inject({ method: 'GET', url: '/products' });
    expect(listResponse.json()).toHaveLength(1);

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/products/${product.id}` });
    expect(deleteResponse.statusCode).toBe(204);

    const getAfterDelete = await app.inject({ method: 'GET', url: `/products/${product.id}` });
    expect(getAfterDelete.statusCode).toBe(404);
  });
});
