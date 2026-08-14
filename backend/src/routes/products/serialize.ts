import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../../shared/auth/jwt.js';

function toCustomerProduct(product: Record<string, unknown>) {
  const { selected_store_price_id: _selectedStorePriceId, original_price: _originalPrice, ...rest } = product;
  return rest;
}

export function serializeProduct(product: Record<string, unknown>, role: Role) {
  return role === 'customer' ? toCustomerProduct(product) : product;
}

// Route-level `preSerialization` hook — applied once, in `routes/index.ts`,
// to every product-read route, instead of every handler calling
// `serializeProduct` on its own way out. Runs on the raw returned object
// (list.ts/search.ts return arrays, get.ts/barcode/get.ts return one product
// or a plain `{ error }` object on 404 — serializeProduct is a no-op on
// anything that isn't shaped like a product, so this is safe for both).
export async function shapeProductResponse(request: FastifyRequest, _reply: FastifyReply, payload: unknown) {
  const role = request.account?.role;
  if (!role) return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => serializeProduct(item as Record<string, unknown>, role));
  }
  if (payload && typeof payload === 'object') {
    return serializeProduct(payload as Record<string, unknown>, role);
  }
  return payload;
}
