import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteLoan } from '../../queries/loans/index.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const rowCount = await deleteLoan(Number(request.params.id));
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Loan not found' });
  }
  return reply.code(204).send();
}
