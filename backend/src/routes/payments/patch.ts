import type { FastifyReply, FastifyRequest } from 'fastify';
import { updatePayment, type UpdatePaymentInput } from '../../queries/payments/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateUpdatePayment } from './validation.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdatePaymentInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  const validationError = validateUpdatePayment(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const payment = await updatePayment(id, body);
  if (!payment) {
    return reply.code(404).send({ error: 'Payment not found' });
  }
  return payment;
}
