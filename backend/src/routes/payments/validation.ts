import { hasNul, INT_MAX, isPlainObject, MAX_AMOUNT_TEXT, NUL_MESSAGE } from '../../shared/validation.js';

export interface CreatePaymentBody {
  amount?: number;
  note?: string | null;
}

// Shared by create and update. `required` only changes what a missing amount means.
function validateAmount(amount: unknown, { required }: { required: boolean }): string | null {
  if (amount === undefined && !required) return null;
  if (typeof amount !== 'number' || !(amount > 0)) {
    return required ? 'amount is required and must be greater than 0' : 'amount must be greater than 0';
  }
  if (!Number.isInteger(amount)) return 'amount must be a whole number of centavos';
  if (amount > INT_MAX) return `amount can be at most ${MAX_AMOUNT_TEXT}`;
  return null;
}

function validateNote(note: unknown): string | null {
  if (note === undefined || note === null) return null;
  if (typeof note !== 'string') return 'note must be text or null';
  return hasNul(note) ? NUL_MESSAGE : null;
}

export function validateCreatePayment(body: CreatePaymentBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  return validateAmount(body.amount, { required: true }) ?? validateNote(body.note);
}

export function validateUpdatePayment(body: CreatePaymentBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (body.amount === undefined && body.note === undefined) {
    return 'No updatable fields provided';
  }
  return validateAmount(body.amount, { required: false }) ?? validateNote(body.note);
}
