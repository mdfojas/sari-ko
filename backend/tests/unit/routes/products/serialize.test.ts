import { describe, expect, it } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { serializeProduct, shapeProductResponse } from '../../../../src/routes/products/serialize.js';

const PRODUCT = {
  id: 1,
  name: 'Coke 1.5L',
  other_names: ['Coca-Cola'],
  barcode: '1234567890123',
  sale_price: 8500,
  selected_store_price_id: 11,
  original_price: 6500,
  selected_store_name: 'Puregold',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('serializeProduct', () => {
  it('passes admin/store_owner products through unchanged', () => {
    expect(serializeProduct(PRODUCT, 'admin')).toEqual(PRODUCT);
    expect(serializeProduct(PRODUCT, 'store_owner')).toEqual(PRODUCT);
  });

  it('strips sourcing-cost fields for a customer, keeping sale-facing ones', () => {
    const result = serializeProduct(PRODUCT, 'customer');

    expect(result).toEqual({
      id: 1,
      name: 'Coke 1.5L',
      other_names: ['Coca-Cola'],
      barcode: '1234567890123',
      sale_price: 8500,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('selected_store_price_id');
    expect(result).not.toHaveProperty('original_price');
    expect(result).not.toHaveProperty('selected_store_name');
  });

  it('is fail-closed: a field added to the row that is not on the customer pick-list is dropped, not leaked', () => {
    const result = serializeProduct({ ...PRODUCT, supplier_cost: 4000 }, 'customer');

    expect(result).not.toHaveProperty('supplier_cost');
  });
});

describe('shapeProductResponse (the preSerialization hook on every product read route)', () => {
  const as = (role: 'admin' | 'customer') => ({ account: { role } }) as unknown as FastifyRequest;
  const replying = (statusCode: number) => ({ statusCode }) as unknown as FastifyReply;

  it.each([400, 404, 500])('leaves a %i error body untouched for a customer, instead of emptying it out', async (status) => {
    const error = { error: 'Product not found' };
    expect(await shapeProductResponse(as('customer'), replying(status), error)).toEqual(error);
  });

  it('still shapes a successful single product for a customer', async () => {
    const shaped = (await shapeProductResponse(as('customer'), replying(200), PRODUCT)) as Record<string, unknown>;
    expect(shaped).not.toHaveProperty('original_price');
    expect(shaped.name).toBe('Coke 1.5L');
  });

  it('still shapes every product in a list for a customer', async () => {
    const shaped = (await shapeProductResponse(as('customer'), replying(200), [PRODUCT, PRODUCT])) as Record<string, unknown>[];
    expect(shaped).toHaveLength(2);
    expect(shaped.every((p) => !('selected_store_name' in p))).toBe(true);
  });

  it('passes admin and store_owner responses through unchanged, errors included', async () => {
    expect(await shapeProductResponse(as('admin'), replying(200), PRODUCT)).toEqual(PRODUCT);
    expect(await shapeProductResponse(as('admin'), replying(404), { error: 'x' })).toEqual({ error: 'x' });
  });
});
