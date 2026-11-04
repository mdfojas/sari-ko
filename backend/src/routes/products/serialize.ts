import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../../shared/auth/jwt.js';

// Fail-closed pick-list, not a fail-open omit-list: a customer only ever
// sees fields explicitly listed here. A future field added to PRODUCT_SELECT
// (e.g. a supplier cost) is hidden by default instead of leaking unless
// someone remembers to add it to a blacklist.
const CUSTOMER_VISIBLE_FIELDS = [
  'id',
  'name',
  'other_names',
  'barcode',
  'sale_price',
  'created_at',
  'updated_at',
] as const;

function toCustomerProduct(product: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const field of CUSTOMER_VISIBLE_FIELDS) {
    result[field] = product[field];
  }
  return result;
}

export function serializeProduct(product: Record<string, unknown>, role: Role) {
  return role === 'customer' ? toCustomerProduct(product) : product;
}

// Route-level `preSerialization` hook — applied once, in `routes/index.ts`,
// to every product-read route, instead of every handler calling
// `serializeProduct` on its own way out. Runs on the raw returned object:
// list.ts/search.ts return arrays, get.ts/barcode/get.ts one product.
// Error responses (a 404 `{ error }`, requireIdParam's 400) are skipped: they
// hold no product data, and the customer pick-list would otherwise copy only
// its named fields out of them and send back an empty `{}`.
export async function shapeProductResponse(request: FastifyRequest, reply: FastifyReply, payload: unknown) {
  const role = request.account?.role;
  if (!role || reply.statusCode >= 400) return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => serializeProduct(item as Record<string, unknown>, role));
  }
  if (payload && typeof payload === 'object') {
    return serializeProduct(payload as Record<string, unknown>, role);
  }
  return payload;
}
