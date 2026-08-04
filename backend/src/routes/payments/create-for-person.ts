import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPayment, type CreatePaymentInput } from '../../queries/payments/index.js';
import { validateCreatePayment, type CreatePaymentBody } from './validation.js';

export async function createForPerson(
  request: FastifyRequest<{ Params: { id: string }; Body: CreatePaymentBody }>,
  reply: FastifyReply,
) {
  const personId = Number(request.params.id);
  const body = request.body;

  const validationError = validateCreatePayment(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const payment = await createPayment(personId, body as CreatePaymentInput);
  return reply.code(201).send(payment);
}
