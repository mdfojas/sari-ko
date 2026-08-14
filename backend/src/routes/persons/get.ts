import type { FastifyReply, FastifyRequest } from 'fastify';
import { findPersonById } from '../../queries/persons/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const person = await findPersonById(id);
  if (!person) {
    return reply.code(404).send({ error: 'Person not found' });
  }
  return person;
}
