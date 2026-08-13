import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteLoan } from '../../queries/loans/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const rowCount = await deleteLoan(id);
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Loan not found' });
  }
  return reply.code(204).send();
}
