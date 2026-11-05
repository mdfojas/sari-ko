import type { FastifyReply, FastifyRequest } from 'fastify';
import { createProduct, findProductById } from '../../queries/products/index.js';
import { StoreChangedError } from '../../queries/stores/index.js';
import { isForeignKeyViolation, isRetryableConflict, isUniqueViolation } from '../../shared/pg-errors.js';
import { normalizeBarcode, validateCreateProduct, type CreateProductBody } from './validation.js';

export async function post(request: FastifyRequest<{ Body: CreateProductBody }>, reply: FastifyReply) {
  const body = request.body;

  const validationError = validateCreateProduct(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const name = body.name as string;
  const storePrices = body.store_prices ?? [];

  try {
    const productId = await createProduct({ ...body, name, barcode: normalizeBarcode(body.barcode), store_prices: storePrices });
    const product = await findProductById(productId);
    return reply.code(201).send(product);
  } catch (err) {
    // Only the barcode column's unique index is about the barcode (a store price has its own).
    if (isUniqueViolation(err) && (err as { constraint?: string }).constraint?.includes('barcode')) {
      return reply.code(409).send({ error: 'A product with this barcode already exists' });
    }
    // Two store names the database treats as one store (for example a dotted capital I against a
    // plain i) that the request check, which compares in JavaScript, saw as different.
    if (isUniqueViolation(err) && (err as { constraint?: string }).constraint === 'store_prices_product_store_key') {
      return reply.code(400).send({ error: 'A product can have only one price per store' });
    }
    // A store it was about to use was merged or deleted at that moment, or the database aborted
    // this request in a deadlock with another one; nothing was saved.
    if (err instanceof StoreChangedError || isForeignKeyViolation(err) || isRetryableConflict(err)) {
      return reply.code(409).send({ error: 'A store was just changed. Please try again.' });
    }
    throw err;
  }
}
