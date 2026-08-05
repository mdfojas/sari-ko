import type { FastifyReply, FastifyRequest } from 'fastify';
import { deletePayment } from '../../queries/payments/index.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const rowCount = await deletePayment(Number(request.params.id));
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Payment not found' });
  }
  return reply.code(204).send();
}
