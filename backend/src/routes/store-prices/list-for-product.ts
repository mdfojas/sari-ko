import type { FastifyReply, FastifyRequest } from 'fastify';
import { listStorePricesByProductId } from '../../queries/store-prices/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function listForProduct(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  return listStorePricesByProductId(id);
}
