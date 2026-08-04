import type { FastifyReply, FastifyRequest } from 'fastify';
import { findPersonById } from '../../queries/persons/index.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const person = await findPersonById(Number(request.params.id));
  if (!person) {
    return reply.code(404).send({ error: 'Person not found' });
  }
  return person;
}
