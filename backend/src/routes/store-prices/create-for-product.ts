import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductById } from '../../queries/products/index.js';
import { createStorePrice } from '../../queries/store-prices/index.js';

export interface CreateStorePriceBody {
  store_name?: string;
  price?: number;
}

export async function createForProduct(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateStorePriceBody }>,
  reply: FastifyReply,
) {
  const productId = Number(request.params.id);
  const { store_name, price } = request.body;

  if (!store_name || price === undefined) {
    return reply.code(400).send({ error: 'store_name and price are required' });
  }

  const product = await findProductById(productId);
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }

  const storePrice = await createStorePrice(productId, store_name, price);
  return reply.code(201).send(storePrice);
}
