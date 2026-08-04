import type { FastifyReply, FastifyRequest } from 'fastify';
import { deletePerson, isForeignKeyViolation } from '../../queries/persons/index.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const rowCount = await deletePerson(Number(request.params.id));
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Person not found' });
    }
    return reply.code(204).send();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return reply.code(409).send({ error: 'Cannot delete a person with existing loans or payments' });
    }
    throw err;
  }
}
