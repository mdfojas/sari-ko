import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanById, findLoanOwnerId } from '../../queries/loans/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { checkLoanOwnership } from './loan-ownership.js';

export async function loan(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  // Ownership first, with the cheap lookup the line-items and history bridges
  // use: loading the full loan (with its SUM subquery) before checking would
  // make someone else's loan measurably slower to answer than a missing one.
  const ownerId = await findLoanOwnerId(id);
  const check = checkLoanOwnership(ownerId, request.account!.personId!);
  if (!check.ok) {
    return reply.code(check.status).send({ error: 'Loan not found' });
  }
  return findLoanById(id);
}
