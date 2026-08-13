import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPayment, type CreatePaymentInput } from '../../queries/payments/index.js';
import { isForeignKeyViolation } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateCreatePayment, type CreatePaymentBody } from './validation.js';

export async function createForPerson(
  request: FastifyRequest<{ Params: { id: string }; Body: CreatePaymentBody }>,
  reply: FastifyReply,
) {
  const personId = requireIdParam(request.params.id, reply);
  if (personId === null) return;
  const body = request.body;

  const validationError = validateCreatePayment(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  try {
    const payment = await createPayment(personId, body as CreatePaymentInput);
    return reply.code(201).send(payment);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      return reply.code(404).send({ error: 'Person not found' });
    }
    throw err;
  }
}
