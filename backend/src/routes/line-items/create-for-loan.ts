import type { FastifyReply, FastifyRequest } from 'fastify';
import { insertLineItem, ProductNotFoundError, type CreateLineItemInput } from '../../queries/line-items/index.js';
import { pool } from '../../shared/db.js';
import { isForeignKeyViolation } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateCreateLineItem } from './validation.js';

export async function createForLoan(
  request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateLineItemInput> }>,
  reply: FastifyReply,
) {
  const loanId = requireIdParam(request.params.id, reply);
  if (loanId === null) return;
  const body = request.body;

  const validationError = validateCreateLineItem(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  try {
    const lineItem = await insertLineItem(pool, loanId, body as CreateLineItemInput);
    return reply.code(201).send(lineItem);
  } catch (err) {
    if (err instanceof ProductNotFoundError) {
      return reply.code(400).send({ error: err.message });
    }
    if (isForeignKeyViolation(err)) {
      return reply.code(404).send({ error: 'Loan not found' });
    }
    throw err;
  }
}
