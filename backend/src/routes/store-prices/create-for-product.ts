import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductById } from '../../queries/products/index.js';
import { createStorePrice, DuplicateStorePriceError } from '../../queries/store-prices/index.js';
import { StoreChangedError } from '../../queries/stores/index.js';
import { isForeignKeyViolation, isRetryableConflict } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateCreateStorePrice, type CreateStorePriceBody } from './validation.js';

export async function createForProduct(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateStorePriceBody }>,
  reply: FastifyReply,
) {
  const productId = requireIdParam(request.params.id, reply);
  if (productId === null) return;
  const body = request.body;

  const validationError = validateCreateStorePrice(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const product = await findProductById(productId);
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }

  try {
    const storePrice = await createStorePrice(productId, body.store_name as string, body.price as number);
    return reply.code(201).send(storePrice);
  } catch (err) {
    if (err instanceof DuplicateStorePriceError) return reply.code(409).send({ error: err.message });
    if (err instanceof StoreChangedError || isRetryableConflict(err)) {
      return reply.code(409).send({ error: 'That store was just changed. Please try again.' });
    }
    if (isForeignKeyViolation(err)) {
      // Either the product was deleted after the check above, or the store was merged or deleted
      // between finding it and saving the price. Either way the transaction rolled back.
      if (!(await findProductById(productId))) return reply.code(404).send({ error: 'Product not found' });
      return reply.code(409).send({ error: 'That store was just changed. Please try again.' });
    }
    throw err;
  }
}
