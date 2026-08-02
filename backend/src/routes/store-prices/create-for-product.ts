import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductById } from '../../queries/products/index.js';
import { createStorePrice } from '../../queries/store-prices/index.js';
import { validateCreateStorePrice, type CreateStorePriceBody } from './validation.js';

export async function createForProduct(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateStorePriceBody }>,
  reply: FastifyReply,
) {
  const productId = Number(request.params.id);
  const body = request.body;

  const validationError = validateCreateStorePrice(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const product = await findProductById(productId);
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }

  const storePrice = await createStorePrice(productId, body.store_name as string, body.price as number);
  return reply.code(201).send(storePrice);
}
