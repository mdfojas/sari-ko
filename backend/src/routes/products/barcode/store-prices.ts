import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductSummaryByBarcode } from '../../../queries/products/index.js';
import { listStorePricesByProductId } from '../../../queries/store-prices/index.js';

export async function storePrices(request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) {
  const product = await findProductSummaryByBarcode(request.params.code);
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }
  const prices = await listStorePricesByProductId(product.id);
  return { product, store_prices: prices };
}
