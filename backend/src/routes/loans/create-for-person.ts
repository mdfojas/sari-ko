import type { FastifyReply, FastifyRequest } from 'fastify';
import { createLoanForPerson, findLoanById, type CreateLoanInput } from '../../queries/loans/index.js';
import { ProductNotFoundError } from '../../queries/line-items/index.js';
import { isForeignKeyViolation } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateCreateLoan } from './validation.js';
import { validateCreateLineItem } from '../line-items/validation.js';

export async function createForPerson(
  request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateLoanInput> }>,
  reply: FastifyReply,
) {
  const personId = requireIdParam(request.params.id, reply);
  if (personId === null) return;
  const body = request.body;

  const validationError = validateCreateLoan(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  for (const lineItem of body.line_items ?? []) {
    const lineItemError = validateCreateLineItem(lineItem);
    if (lineItemError) {
      return reply.code(400).send({ error: lineItemError });
    }
  }

  try {
    const loanId = await createLoanForPerson(personId, {
      note: body.note,
      line_items: body.line_items as CreateLoanInput['line_items'],
    });
    const loan = await findLoanById(loanId);
    return reply.code(201).send(loan);
  } catch (err) {
    if (err instanceof ProductNotFoundError) {
      return reply.code(400).send({ error: err.message });
    }
    if (isForeignKeyViolation(err)) {
      return reply.code(404).send({ error: 'Person not found' });
    }
    throw err;
  }
}
