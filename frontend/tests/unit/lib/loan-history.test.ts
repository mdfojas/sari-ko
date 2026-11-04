import { describe, expect, test } from 'vitest';
import { describeHistoryEntry } from '@/lib/loan-history';
import type { LoanHistoryEntry } from '@/lib/loans-client';

const entry = (over: Partial<LoanHistoryEntry>): LoanHistoryEntry => ({
  id: 1,
  entity_type: 'loan',
  entity_id: 1,
  action: 'create',
  changes: {},
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('describeHistoryEntry', () => {
  test('a loan being created or deleted', () => {
    expect(describeHistoryEntry(entry({ action: 'create' }))).toBe('Loan created');
    expect(describeHistoryEntry(entry({ action: 'delete' }))).toBe('Loan deleted');
  });

  test('a line item being added shows what and how much', () => {
    expect(
      describeHistoryEntry(entry({ entity_type: 'loan_line_item', action: 'create', changes: { description: '1kg rice', amount: 5800 } }))
    ).toBe('Added "1kg rice" (₱58.00)');
  });

  test('a line item being removed shows what and how much', () => {
    expect(
      describeHistoryEntry(entry({ entity_type: 'loan_line_item', action: 'delete', changes: { description: 'Kulang', amount: 1500 } }))
    ).toBe('Removed "Kulang" (₱15.00)');
  });

  test('a line item edit lists each changed field, formatting money as pesos and ignoring updated_at', () => {
    expect(
      describeHistoryEntry(
        entry({
          entity_type: 'loan_line_item',
          action: 'update',
          changes: {
            amount: { from: 500, to: 1000 },
            quantity: { from: 1, to: 2 },
            updated_at: { from: 'a', to: 'b' },
          },
        })
      )
    ).toBe('Line item changed: amount ₱5.00 → ₱10.00; quantity 1 → 2');
  });

  test('a loan note edit', () => {
    expect(
      describeHistoryEntry(entry({ action: 'update', changes: { note: { from: null, to: 'weekly' }, updated_at: { from: 'a', to: 'b' } } }))
    ).toBe('Loan changed: note (none) → weekly');
  });

  test('an update that only touched updated_at is still described, not blank', () => {
    expect(describeHistoryEntry(entry({ action: 'update', changes: { updated_at: { from: 'a', to: 'b' } } }))).toBe('Loan updated');
  });
});
