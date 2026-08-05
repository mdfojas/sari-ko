import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanById } from '../../queries/loans/index.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const loan = await findLoanById(Number(request.params.id));
  if (!loan) {
    return reply.code(404).send({ error: 'Loan not found' });
  }
  return loan;
}
