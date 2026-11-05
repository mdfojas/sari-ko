import type { FastifyReply, FastifyRequest } from 'fastify';
import { listPricesAtStore, StoreNotFoundError } from '../../queries/stores/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function prices(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  try {
    return await listPricesAtStore(id);
  } catch (err) {
    if (err instanceof StoreNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}
