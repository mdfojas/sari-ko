import type { FastifyReply, FastifyRequest } from 'fastify';
import { listLineItemsByLoanId } from '../../queries/line-items/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function listForLoan(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  return listLineItemsByLoanId(id);
}
