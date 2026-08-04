import type { FastifyRequest } from 'fastify';
import { listLineItemsByLoanId } from '../../queries/line-items/index.js';

export async function listForLoan(request: FastifyRequest<{ Params: { id: string } }>) {
  return listLineItemsByLoanId(Number(request.params.id));
}
