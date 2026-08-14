import type { FastifyReply, FastifyRequest } from 'fastify';
import { updateStorePrice, type UpdateStorePriceInput } from '../../queries/store-prices/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { hasStorePriceUpdate } from './validation.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateStorePriceInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  if (!hasStorePriceUpdate(body)) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  const storePrice = await updateStorePrice(id, body);
  if (!storePrice) {
    return reply.code(404).send({ error: 'Store price not found' });
  }
  return storePrice;
}
