import type { FastifyReply, FastifyRequest } from 'fastify';
import { findStorePriceById } from '../../queries/store-prices/index.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const storePrice = await findStorePriceById(Number(request.params.id));
  if (!storePrice) {
    return reply.code(404).send({ error: 'Store price not found' });
  }
  return storePrice;
}
