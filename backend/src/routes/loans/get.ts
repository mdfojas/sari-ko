import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanById } from '../../queries/loans/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const loan = await findLoanById(id);
  if (!loan) {
    return reply.code(404).send({ error: 'Loan not found' });
  }
  return loan;
}
