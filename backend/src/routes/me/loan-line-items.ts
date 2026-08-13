import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanOwnerId } from '../../queries/loans/index.js';
import { listLineItemsByLoanId } from '../../queries/line-items/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { checkLoanOwnership } from './loan-ownership.js';

export async function loanLineItems(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  const ownerId = await findLoanOwnerId(id);
  const check = checkLoanOwnership(ownerId, request.account!.personId!);
  if (!check.ok) {
    return reply.code(check.status).send({ error: check.status === 404 ? 'Loan not found' : 'Forbidden' });
  }
  return listLineItemsByLoanId(id);
}
