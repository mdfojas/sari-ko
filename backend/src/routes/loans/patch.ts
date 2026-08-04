import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLoanById, updateLoan, type UpdateLoanInput } from '../../queries/loans/index.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLoanInput }>,
  reply: FastifyReply,
) {
  const id = Number(request.params.id);
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
