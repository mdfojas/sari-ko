import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteStore, StoreInUseError, StoreNotFoundError } from '../../queries/stores/index.js';
import { isForeignKeyViolation, isRetryableConflict } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  try {
    return { deleted: await deleteStore(id) };
  } catch (err) {
    if (err instanceof StoreNotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof StoreInUseError) return reply.code(409).send({ error: err.message });
    // A product started using one of the prices as its sale source after the check above.
    if (isForeignKeyViolation(err) || isRetryableConflict(err)) {
      return reply.code(409).send({ error: 'A product just started taking its sale price from this store. Try again.' });
    }
    throw err;
  }
}
