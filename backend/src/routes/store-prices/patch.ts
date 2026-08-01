import type { FastifyReply, FastifyRequest } from 'fastify';
import { updateStorePrice, type UpdateStorePriceInput } from '../../queries/store-prices/index.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateStorePriceInput }>,
  reply: FastifyReply,
) {
  const id = Number(request.params.id);
  const { store_name, price } = request.body;

  if (store_name === undefined && price === undefined) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  const storePrice = await updateStorePrice(id, { store_name, price });
  if (!storePrice) {
    return reply.code(404).send({ error: 'Store price not found' });
  }
  return storePrice;
}
