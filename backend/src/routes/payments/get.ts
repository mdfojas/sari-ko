import type { FastifyReply, FastifyRequest } from 'fastify';
import { findPaymentById } from '../../queries/payments/index.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const payment = await findPaymentById(Number(request.params.id));
  if (!payment) {
    return reply.code(404).send({ error: 'Payment not found' });
  }
  return payment;
}
