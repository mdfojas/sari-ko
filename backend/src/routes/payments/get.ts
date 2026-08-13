import type { FastifyReply, FastifyRequest } from 'fastify';
import { findPaymentById } from '../../queries/payments/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const payment = await findPaymentById(id);
  if (!payment) {
    return reply.code(404).send({ error: 'Payment not found' });
  }
  return payment;
}
