import { describe, expect, it } from 'vitest';
import { buildSetClause } from '../../../src/shared/sql.js';

describe('buildSetClause', () => {
  it('builds a SET fragment only for defined fields', () => {
    expect(buildSetClause({ name: 'Coke', price: undefined, barcode: null })).toEqual({
      setClause: 'name = $1, barcode = $2',
      values: ['Coke', null],
    });
  });

  it('numbers placeholders in insertion order', () => {
    expect(buildSetClause({ a: 'x', b: 'y', c: 'z' })).toEqual({
      setClause: 'a = $1, b = $2, c = $3',
      values: ['x', 'y', 'z'],
    });
  });

  it('returns an empty clause when every field is undefined', () => {
    expect(buildSetClause({ a: undefined, b: undefined })).toEqual({
      setClause: '',
      values: [],
    });
  });
});
