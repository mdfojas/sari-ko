import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  mergeStore,
  StoreChangedError,
  StoreMergeConflictError,
  StoreNotFoundError,
  StoreSelfMergeError,
} from '../../queries/stores/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateMergeStore, type MergeStoreBody } from './validation.js';

export async function merge(request: FastifyRequest<{ Params: { id: string }; Body: MergeStoreBody }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  const validationError = validateMergeStore(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  try {
    return await mergeStore(id, body.into as number);
  } catch (err) {
    if (err instanceof StoreSelfMergeError) return reply.code(400).send({ error: err.message });
    if (err instanceof StoreNotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof StoreMergeConflictError || err instanceof StoreChangedError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}
