import type { CreateLineItemInput, UpdateLineItemInput } from '../../queries/line-items/index.js';
import {
  hasNul,
  INT_MAX,
  isNonBlankString,
  isPlainObject,
  isPositiveInteger,
  MAX_AMOUNT_TEXT,
  NUL_MESSAGE,
} from '../../shared/validation.js';

export function validateCreateLineItem(body: Partial<CreateLineItemInput>): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';

  // Catalog item: a product and a quantity. The backend takes the price
  // snapshot, so only the product and the quantity are validated here.
  if (body.product_id !== undefined) {
    if (!isPositiveInteger(body.product_id) || body.product_id > INT_MAX) {
      return 'product_id must be a positive whole number';
    }
    if (body.quantity === undefined) {
      return 'quantity is required for a product-linked line item';
    }
    if (!isPositiveInteger(body.quantity) || body.quantity > INT_MAX) {
      return 'quantity must be a whole number of at least 1';
    }
    return null;
  }

  // Freeform item: a description and an amount in whole centavos.
  if (!isNonBlankString(body.description) || body.amount === undefined) {
    return 'description and amount are required for a freeform line item';
  }
  if (hasNul(body.description)) return NUL_MESSAGE;
  if (typeof body.amount !== 'number' || Number.isNaN(body.amount) || !Number.isInteger(body.amount)) {
    return 'amount must be a whole number of centavos';
  }
  if (body.amount <= 0) return 'amount must be greater than 0';
  if (body.amount > INT_MAX) return `amount can be at most ${MAX_AMOUNT_TEXT}`;
  return null;
}

export function validateUpdateLineItem(body: UpdateLineItemInput): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';

  if (body.description !== undefined) {
    if (!isNonBlankString(body.description)) return 'description must be non-blank text';
    if (hasNul(body.description)) return NUL_MESSAGE;
  }
  if (body.quantity !== undefined) {
    if (!isPositiveInteger(body.quantity) || body.quantity > INT_MAX) {
      return 'quantity must be a whole number of at least 1';
    }
  }
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !Number.isInteger(body.amount)) {
      return 'amount must be a whole number of centavos';
    }
    if (body.amount <= 0) return 'amount must be greater than 0';
    if (body.amount > INT_MAX) return `amount can be at most ${MAX_AMOUNT_TEXT}`;
  }
  return null;
}
