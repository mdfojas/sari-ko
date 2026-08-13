import type { FastifyReply, FastifyRequest } from 'fastify';
import { getHistoryForLoan } from '../../queries/loans/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function history(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  return getHistoryForLoan(id);
}
