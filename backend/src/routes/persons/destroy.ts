import type { FastifyReply, FastifyRequest } from 'fastify';
import { deletePerson } from '../../queries/persons/index.js';
import { isForeignKeyViolation } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  try {
    const rowCount = await deletePerson(id);
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Person not found' });
    }
    return reply.code(204).send();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return reply.code(409).send({ error: 'Cannot delete a person with existing loans, payments, or a linked account' });
    }
    throw err;
  }
}
