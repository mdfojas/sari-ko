import type { CreateLoanInput } from '../../queries/loans/index.js';

export function validateCreateLoan(body: Partial<CreateLoanInput>): string | null {
  if (!body.line_items || body.line_items.length < 1) {
    return 'At least one line item is required';
  }
  return null;
}
