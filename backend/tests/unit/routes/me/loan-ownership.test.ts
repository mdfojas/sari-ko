import { describe, expect, it } from 'vitest';
import { checkLoanOwnership } from '../../../../src/routes/me/loan-ownership.js';

describe('checkLoanOwnership', () => {
  it('returns ok when the actual owner matches the caller', () => {
    expect(checkLoanOwnership(5, 5)).toEqual({ ok: true });
  });

  it('returns 404 when the loan does not exist (null owner)', () => {
    expect(checkLoanOwnership(null, 5)).toEqual({ ok: false, status: 404 });
  });

  it('returns 403 when the loan belongs to a different person', () => {
    expect(checkLoanOwnership(7, 5)).toEqual({ ok: false, status: 403 });
  });
});
