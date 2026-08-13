import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanById } from '../../queries/loans/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { checkLoanOwnership } from './loan-ownership.js';

export async function loan(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  // The full loan (with its total) is the response here, so fetching it
  // once and checking ownership on the already-fetched row is the minimal
  // work possible — unlike the line-items/history bridges below, there's
  // no separate cheap-vs-full-fetch tradeoff to make.
  const loanData = await findLoanById(id);
  const check = checkLoanOwnership(loanData?.person_id ?? null, request.account!.personId!);
  if (!check.ok) {
    return reply.code(check.status).send({ error: check.status === 404 ? 'Loan not found' : 'Forbidden' });
  }
  return loanData;
}
