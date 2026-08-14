import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanById, updateLoan, type UpdateLoanInput } from '../../queries/loans/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLoanInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  if (body.note === undefined) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  const rowCount = await updateLoan(id, body);
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Loan not found' });
  }
  return findLoanById(id);
}
