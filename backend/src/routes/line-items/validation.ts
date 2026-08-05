import type { CreateLineItemInput } from '../../queries/line-items/index.js';

export function validateCreateLineItem(body: Partial<CreateLineItemInput>): string | null {
  if (body.product_id !== undefined) {
    if (body.quantity === undefined) {
      return 'quantity is required for a product-linked line item';
    }
    return null;
  }
  if (!body.description || body.amount === undefined) {
    return 'description and amount are required for a freeform line item';
  }
  return null;
}
