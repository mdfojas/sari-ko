import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteStorePrice, isStorePriceSelectedByAnyProduct } from '../../queries/store-prices/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  if (await isStorePriceSelectedByAnyProduct(id)) {
    return reply.code(409).send({ error: 'Cannot delete a store price that is currently selected for a product' });
  }

  const rowCount = await deleteStorePrice(id);
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Store price not found' });
  }
  return reply.code(204).send();
}
