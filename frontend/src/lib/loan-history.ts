import { peso } from './money';
import type { LoanHistoryEntry } from './loans-client';

const MONEY_FIELDS = new Set(['amount', 'unit_price']);

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '(none)';
  if (MONEY_FIELDS.has(field) && typeof value === 'number') return peso(value);
  return String(value);
}

// Turns a raw audit_log row into one human-readable line.
export function describeHistoryEntry(entry: LoanHistoryEntry): string {
  const isLoan = entry.entity_type === 'loan';

  if (entry.action === 'update') {
    const changed = Object.entries(entry.changes as Record<string, { from: unknown; to: unknown }>)
      .filter(([field]) => field !== 'updated_at')
      .map(([field, { from, to }]) => `${field} ${formatValue(field, from)} → ${formatValue(field, to)}`);
    const subject = isLoan ? 'Loan' : 'Line item';
    return changed.length > 0 ? `${subject} changed: ${changed.join('; ')}` : `${subject} updated`;
  }

  if (isLoan) return entry.action === 'create' ? 'Loan created' : 'Loan deleted';

  const { description, amount } = entry.changes as { description?: string; amount?: number };
  const detail = `"${description ?? ''}" (${peso(amount ?? 0)})`;
  return entry.action === 'create' ? `Added ${detail}` : `Removed ${detail}`;
}
