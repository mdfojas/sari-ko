import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /products/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/1' });
    expect(response.statusCode).toBe(401);
  });

  it('gets a single product', async () => {
    const product = await createProduct({
      name: 'Fetchable Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Fetchable Product');
    expect(body.selected_store_name).toBe('Puregold');
  });

  it('returns 404 for an unknown product id', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/999999', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(404);
  });

  it('returns 400, not a raw 500, for a non-numeric id', async () => {
    const response = await app.inject({ method: 'GET', url: '/products/abc', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(400);
  });

  it('gives a customer the same 404 body as an admin, not an emptied-out {}', async () => {
    const asAdmin = await app.inject({ method: 'GET', url: '/products/999999', headers: authHeaderFor('admin') });
    const asCustomer = await app.inject({ method: 'GET', url: '/products/999999', headers: authHeaderFor('customer') });

    expect(asCustomer.statusCode).toBe(404);
    expect(asCustomer.json()).toEqual({ error: 'Product not found' });
    expect(asCustomer.json()).toEqual(asAdmin.json());
  });

  it('gives a customer the same 400 body as an admin for a non-numeric id', async () => {
    const asAdmin = await app.inject({ method: 'GET', url: '/products/abc', headers: authHeaderFor('admin') });
    const asCustomer = await app.inject({ method: 'GET', url: '/products/abc', headers: authHeaderFor('customer') });

    expect(asCustomer.statusCode).toBe(400);
    expect(asCustomer.json()).toEqual({ error: 'id must be a positive integer' });
    expect(asCustomer.json()).toEqual(asAdmin.json());
  });

  it('omits store-price fields for a customer, keeping sale_price', async () => {
    const product = await createProduct({
      name: 'Fetchable Product',
      store_prices: [{ store_name: 'Puregold', price: 1000, selected: true }],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/products/${product.id}`,
      headers: authHeaderFor('customer'),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sale_price).toBeDefined();
    expect(body.selected_store_price_id).toBeUndefined();
    expect(body.original_price).toBeUndefined();
    expect(body.selected_store_name).toBeUndefined();
  });
});
