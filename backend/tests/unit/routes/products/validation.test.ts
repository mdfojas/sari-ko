import { describe, expect, it } from 'vitest';
import {
  hasProductUpdate,
  normalizeBarcode,
  validateCreateProduct,
  validateUpdateProduct,
} from '../../../../src/routes/products/validation.js';

describe('validateCreateProduct', () => {
  it('requires a name', () => {
    expect(validateCreateProduct({ store_prices: [{ store_name: 'A', price: 100, selected: true }] })).toBe(
      'name is required',
    );
  });

  it('requires at least one store price', () => {
    expect(validateCreateProduct({ name: 'Coke', store_prices: [] })).toBe(
      'At least one store price is required',
    );
  });

  it('requires one store price to be marked selected', () => {
    expect(
      validateCreateProduct({ name: 'Coke', store_prices: [{ store_name: 'A', price: 100 }] }),
    ).toBe('One store price must be marked as selected');
  });

  it('returns null when the body is valid', () => {
    expect(
      validateCreateProduct({
        name: 'Coke',
        store_prices: [{ store_name: 'A', price: 100, selected: true }],
      }),
    ).toBeNull();
  });

  it('rejects a store price with a blank store name', () => {
    expect(
      validateCreateProduct({
        name: 'Coke',
        store_prices: [{ store_name: '', price: 100, selected: true }],
      }),
    ).toBe('Each store price needs a store name and a price greater than ₱0');
  });

  it('rejects a store price with a zero price', () => {
    expect(
      validateCreateProduct({
        name: 'Coke',
        store_prices: [{ store_name: 'A', price: 0, selected: true }],
      }),
    ).toBe('Each store price needs a store name and a price greater than ₱0');
  });

  it('rejects a store price with a negative price', () => {
    expect(
      validateCreateProduct({
        name: 'Coke',
        store_prices: [{ store_name: 'A', price: -100, selected: true }],
      }),
    ).toBe('Each store price needs a store name and a price greater than ₱0');
  });
});

describe('validateCreateProduct — wrongly-typed input (only direct API callers can send these)', () => {
  const body = (storePrice: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ name: 'Coke', store_prices: [{ selected: true, ...storePrice }], ...extra }) as never;

  it('returns a validation message, instead of throwing, for a non-string store name', () => {
    expect(validateCreateProduct(body({ store_name: 123, price: 100 }))).toBe(
      'Each store price needs a store name and a price greater than ₱0',
    );
  });

  it.each([12.5, '5', Number.NaN, Number.POSITIVE_INFINITY, null])(
    'rejects the non-integer store price %s, since prices are whole centavos',
    (price) => {
      expect(validateCreateProduct(body({ store_name: 'A', price }))).toBe(
        'Each store price needs a store name and a price greater than ₱0',
      );
    },
  );

  it('accepts a whole-centavo store price', () => {
    expect(validateCreateProduct(body({ store_name: 'A', price: 1250 }))).toBeNull();
  });

  it('leaves sale_price optional, since the database supplies a default', () => {
    expect(validateCreateProduct(body({ store_name: 'A', price: 100 }))).toBeNull();
  });

  it.each([0, -100, 12.5, '5', Number.NaN])('rejects the sale_price %s with a message, not a database error', (sale_price) => {
    expect(validateCreateProduct(body({ store_name: 'A', price: 100 }, { sale_price }))).toBe(
      'sale_price must be a whole number of centavos greater than ₱0',
    );
  });

  it('accepts a whole-centavo sale_price', () => {
    expect(validateCreateProduct(body({ store_name: 'A', price: 100 }, { sale_price: 2125 }))).toBeNull();
  });
});

const INT_MAX = 2_147_483_647; // PostgreSQL INTEGER ceiling, in centavos (₱21,474,836.47)

describe('validateCreateProduct — upper bound of the INTEGER columns', () => {
  const body = (price: number, extra: Record<string, unknown> = {}) =>
    ({ name: 'Coke', store_prices: [{ store_name: 'A', price, selected: true }], ...extra }) as never;

  it('accepts a price of exactly the INTEGER maximum', () => {
    expect(validateCreateProduct(body(INT_MAX))).toBeNull();
  });

  it('rejects a store price one centavo over it, with a message — not a database overflow error', () => {
    expect(validateCreateProduct(body(INT_MAX + 1))).toBe('A store price can be at most ₱21,474,836.47');
    expect(validateCreateProduct(body(3_000_000_000))).toBe('A store price can be at most ₱21,474,836.47');
  });

  it('applies the same ceiling to sale_price', () => {
    expect(validateCreateProduct(body(100, { sale_price: INT_MAX }))).toBeNull();
    expect(validateCreateProduct(body(100, { sale_price: INT_MAX + 1 }))).toBe('sale_price can be at most ₱21,474,836.47');
  });
});

describe('validateCreateProduct — malformed request shapes', () => {
  it.each([undefined, null, 'text', 42, []])('rejects a body that is not a JSON object (%s)', (bad) => {
    expect(validateCreateProduct(bad as never)).toBe('Request body must be a JSON object');
  });

  it.each([123, '', '   ', null, {}])('rejects the name %s', (name) => {
    expect(validateCreateProduct({ name, store_prices: [{ store_name: 'A', price: 100, selected: true }] } as never)).toBe(
      'name is required',
    );
  });

  it.each([{}, 'x', 5, null])('rejects store_prices that is not a list (%s) instead of throwing', (store_prices) => {
    expect(validateCreateProduct({ name: 'Coke', store_prices } as never)).toBe(
      store_prices === null ? 'At least one store price is required' : 'store_prices must be a list',
    );
  });

  it.each([null, 5, 'x', []])('rejects a store price entry that is not an object (%s) instead of throwing', (entry) => {
    expect(validateCreateProduct({ name: 'Coke', store_prices: [entry] } as never)).toBe(
      'Each store price must be an object with a store_name and a price',
    );
  });

  it.each([['other_names', 'tuna'], ['other_names', [1, 2]], ['barcode', 12345]])(
    'rejects %s of the wrong type (%j)',
    (field, value) => {
      const message = field === 'other_names' ? 'other_names must be a list of text' : 'barcode must be text or null';
      expect(
        validateCreateProduct({ name: 'Coke', store_prices: [{ store_name: 'A', price: 100, selected: true }], [field]: value } as never),
      ).toBe(message);
    },
  );

  it('accepts a null barcode and a list of aliases', () => {
    expect(
      validateCreateProduct({
        name: 'Coke',
        barcode: null,
        other_names: ['coca-cola', 'coke'],
        store_prices: [{ store_name: 'A', price: 100, selected: true }],
      }),
    ).toBeNull();
  });
});

describe('validateUpdateProduct', () => {
  it.each([{ name: 'New name' }, { sale_price: 2125 }, { barcode: null }, { barcode: '123' }, { other_names: [] }, { selected_store_price_id: 5 }, {}])(
    'accepts %j',
    (body) => {
      expect(validateUpdateProduct(body as never)).toBeNull();
    },
  );

  it.each([undefined, null, 'text', []])('rejects a body that is not a JSON object (%s)', (bad) => {
    expect(validateUpdateProduct(bad as never)).toBe('Request body must be a JSON object');
  });

  it.each([0, -5, 12.5, '5', Number.NaN])('rejects the sale_price %s', (sale_price) => {
    expect(validateUpdateProduct({ sale_price } as never)).toBe('sale_price must be a whole number of centavos greater than ₱0');
  });

  it('rejects a sale_price over the INTEGER ceiling', () => {
    expect(validateUpdateProduct({ sale_price: INT_MAX + 1 })).toBe('sale_price can be at most ₱21,474,836.47');
  });

  it.each(['', '   ', 123, null])('rejects the name %j (it may be omitted, but not blanked)', (name) => {
    expect(validateUpdateProduct({ name } as never)).toBe('name must be non-blank text');
  });

  it.each([0, -1, 1.5, '5', INT_MAX + 1])('rejects the selected_store_price_id %s', (id) => {
    expect(validateUpdateProduct({ selected_store_price_id: id } as never)).toBe(
      'selected_store_price_id must be a positive whole number',
    );
  });

  it('rejects other_names that is not a list of text, and a non-text barcode', () => {
    expect(validateUpdateProduct({ other_names: 'tuna' } as never)).toBe('other_names must be a list of text');
    expect(validateUpdateProduct({ barcode: 5 } as never)).toBe('barcode must be text or null');
  });
});

describe('blank barcodes, other_names null, and NUL bytes', () => {
  const create = (extra: Record<string, unknown>, storePrice: Record<string, unknown> = {}) =>
    ({ name: 'Coke', store_prices: [{ store_name: 'A', price: 100, selected: true, ...storePrice }], ...extra }) as never;

  it.each(['', '   '])('a blank barcode (%j) is accepted by validation — handlers turn it into null', (barcode) => {
    expect(validateCreateProduct(create({ barcode }))).toBeNull();
    expect(validateUpdateProduct({ barcode } as never)).toBeNull();
  });

  it('other_names: null on create is accepted, as before (the query treats it as an empty list)', () => {
    expect(validateCreateProduct(create({ other_names: null }))).toBeNull();
  });

  it('but other_names: null on update is rejected, since the column is NOT NULL', () => {
    expect(validateUpdateProduct({ other_names: null } as never)).toBe('other_names must be a list of text');
  });

  const NUL_MESSAGE = 'Text cannot contain NUL characters';

  it.each([
    ['name', { name: 'Co\u0000ke' }, {}],
    ['barcode', { barcode: '12\u000034' }, {}],
    ['other_names entry', { other_names: ['ok', 'bad\u0000'] }, {}],
    ['store_name', {}, { store_name: 'Pure\u0000gold' }],
  ])('rejects a NUL byte in the create %s (Postgres would refuse it as a 500)', (_field, extra, storePrice) => {
    expect(validateCreateProduct(create({ name: 'Coke', ...extra }, storePrice))).toBe(NUL_MESSAGE);
  });

  it.each([
    { name: 'Co\u0000ke' },
    { barcode: '12\u000034' },
    { other_names: ['bad\u0000'] },
  ])('rejects a NUL byte on update (%j)', (body) => {
    expect(validateUpdateProduct(body as never)).toBe(NUL_MESSAGE);
  });
});

describe('normalizeBarcode', () => {
  it('turns a blank barcode into null so blank ones never collide on the UNIQUE column', () => {
    expect(normalizeBarcode('')).toBeNull();
    expect(normalizeBarcode('   ')).toBeNull();
  });

  it('trims the whitespace around a real barcode, so a lookup by the bare digits finds it', () => {
    expect(normalizeBarcode(' 123 ')).toBe('123');
    expect(normalizeBarcode('\t4800016642125\n')).toBe('4800016642125');
  });

  it('leaves null, undefined, leading zeros and inner spaces alone', () => {
    expect(normalizeBarcode(null)).toBeNull();
    expect(normalizeBarcode(undefined)).toBeUndefined();
    expect(normalizeBarcode('0123456789012')).toBe('0123456789012');
    expect(normalizeBarcode('12 34')).toBe('12 34');
  });
});

describe('hasProductUpdate', () => {
  it('returns false when no updatable field is present', () => {
    expect(hasProductUpdate({})).toBe(false);
  });

  it('returns true when any single updatable field is present', () => {
    expect(hasProductUpdate({ name: 'New name' })).toBe(true);
    expect(hasProductUpdate({ barcode: null })).toBe(true);
    expect(hasProductUpdate({ selected_store_price_id: 5 })).toBe(true);
  });
});
