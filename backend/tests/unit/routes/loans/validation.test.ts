import { describe, expect, it } from 'vitest';
import { validateCreateLoan, validateUpdateLoan } from '../../../../src/routes/loans/validation.js';

const check = (body: unknown) => validateCreateLoan(body as never);

describe('validateCreateLoan', () => {
  it('accepts a loan with line items, with or without a note', () => {
    expect(check({ line_items: [{ description: 'rice', amount: 5800 }] })).toBeNull();
    expect(check({ note: 'weekly', line_items: [{ product_id: 1, quantity: 2 }] })).toBeNull();
    expect(check({ note: null, line_items: [{ product_id: 1, quantity: 2 }] })).toBeNull();
  });

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%s)', (body) => {
    expect(check(body)).toBe('Request body must be a JSON object');
  });

  it.each([{}, { line_items: [] }])('requires at least one line item (%j)', (body) => {
    expect(check(body)).toBe('At least one line item is required');
  });

  it.each([{ line_items: 'x' }, { line_items: {} }, { line_items: 5 }])('requires line_items to be a list (%j)', (body) => {
    expect(check(body)).toBe('line_items must be a list');
  });

  it.each([null, 5, 'x', []])('requires every line item to be an object (%j)', (entry) => {
    expect(check({ line_items: [entry] })).toBe('Each line item must be an object');
  });

  it('rejects a note that is not text, or that holds a NUL byte', () => {
    expect(check({ note: 5, line_items: [{ description: 'x', amount: 1 }] })).toBe('note must be text or null');
    expect(check({ note: 'a\u0000b', line_items: [{ description: 'x', amount: 1 }] })).toBe('Text cannot contain NUL characters');
  });
});

describe('validateUpdateLoan', () => {
  const upd = (body: unknown) => validateUpdateLoan(body as never);

  it.each([{ note: 'weekly' }, { note: null }, { note: '' }, {}])('accepts %j', (body) => {
    expect(upd(body)).toBeNull();
  });

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%s)', (body) => {
    expect(upd(body)).toBe('Request body must be a JSON object');
  });

  it.each([123, {}, true, ['a']])('rejects a note that is not text (%j) instead of silently coercing it', (note) => {
    expect(upd({ note })).toBe('note must be text or null');
  });

  it('rejects a NUL byte in the note', () => {
    expect(upd({ note: 'a\u0000b' })).toBe('Text cannot contain NUL characters');
  });
});
