import type { FastifyReply, FastifyRequest } from 'fastify';
import { updatePerson, type UpdatePersonInput } from '../../queries/persons/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdatePersonInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  if (body.name === undefined && body.contact === undefined) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  const person = await updatePerson(id, body);
  if (!person) {
    return reply.code(404).send({ error: 'Person not found' });
  }
  return person;
}
