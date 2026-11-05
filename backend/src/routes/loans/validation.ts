import type { CreateLoanInput, UpdateLoanInput } from '../../queries/loans/index.js';
import { hasNul, isPlainObject, NUL_MESSAGE } from '../../shared/validation.js';

// Checks the shape of the request. Each line item's own fields are checked by
// validateCreateLineItem in the route, and the loan's TOTAL is checked inside
// the creating transaction, since it depends on product prices only the
// database knows.
export function validateCreateLoan(body: Partial<CreateLoanInput>): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';

  const lineItems: unknown = body.line_items;
  if (lineItems === undefined || (Array.isArray(lineItems) && lineItems.length < 1)) {
    return 'At least one line item is required';
  }
  if (!Array.isArray(lineItems)) return 'line_items must be a list';
  if (!lineItems.every(isPlainObject)) return 'Each line item must be an object';

  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') return 'note must be text or null';
    if (hasNul(body.note)) return NUL_MESSAGE;
  }
  return null;
}

export function validateUpdateLoan(body: UpdateLoanInput): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') return 'note must be text or null';
    if (hasNul(body.note)) return NUL_MESSAGE;
  }
  return null;
}
