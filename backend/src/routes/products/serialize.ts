import type { Role } from '../../shared/auth/jwt.js';

function toCustomerProduct(product: Record<string, unknown>) {
  const { selected_store_price_id: _selectedStorePriceId, original_price: _originalPrice, ...rest } = product;
  return rest;
}

export function serializeProduct(product: Record<string, unknown>, role: Role) {
  return role === 'customer' ? toCustomerProduct(product) : product;
}
