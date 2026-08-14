import type { FastifyReply, FastifyRequest } from 'fastify';
import { findStorePriceById } from '../../queries/store-prices/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const storePrice = await findStorePriceById(id);
  if (!storePrice) {
    return reply.code(404).send({ error: 'Store price not found' });
  }
  return storePrice;
}
