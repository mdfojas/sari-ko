import type { FastifyReply, FastifyRequest } from 'fastify';
import { createStore, StoreExistsError } from '../../queries/stores/index.js';
import { validateCreateStore, type StoreNameBody } from './validation.js';

export async function create(request: FastifyRequest<{ Body: StoreNameBody }>, reply: FastifyReply) {
  const body = request.body;
  const validationError = validateCreateStore(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  try {
    return reply.code(201).send(await createStore(body.name as string));
  } catch (err) {
    if (err instanceof StoreExistsError) return reply.code(409).send({ error: err.message });
    throw err;
  }
}
