import type { FastifyRequest } from 'fastify';
import { getHistoryForLoan } from '../../queries/loans/index.js';

export async function history(request: FastifyRequest<{ Params: { id: string } }>) {
  return getHistoryForLoan(Number(request.params.id));
}
