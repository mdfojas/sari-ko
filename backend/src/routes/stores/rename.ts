import type { FastifyReply, FastifyRequest } from 'fastify';
import { renameStore, StoreExistsError, StoreNotFoundError } from '../../queries/stores/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateRenameStore, type StoreNameBody } from './validation.js';

export async function rename(request: FastifyRequest<{ Params: { id: string }; Body: StoreNameBody }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  const validationError = validateRenameStore(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  try {
    return await renameStore(id, body.name as string);
  } catch (err) {
    if (err instanceof StoreNotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof StoreExistsError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}
