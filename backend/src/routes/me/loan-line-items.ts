import type { FastifyReply, FastifyRequest } from 'fastify';
import { listLineItemsByLoanId } from '../../queries/line-items/index.js';
import { resolveOwnedLoan } from './loan-ownership.js';

export async function loanLineItems(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const result = await resolveOwnedLoan(Number(request.params.id), request.account!.personId!);
  if (!result.ok) {
    return reply.code(result.status).send({ error: result.status === 404 ? 'Loan not found' : 'Forbidden' });
  }
  return listLineItemsByLoanId(result.loan.id);
}
