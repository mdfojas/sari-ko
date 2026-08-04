import type { FastifyReply, FastifyRequest } from 'fastify';
import { createLoanForPerson, findLoanById, type CreateLoanInput } from '../../queries/loans/index.js';
import { ProductNotFoundError } from '../../queries/line-items/index.js';
import { validateCreateLoan } from './validation.js';

export async function createForPerson(
  request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateLoanInput> }>,
  reply: FastifyReply,
) {
  const personId = Number(request.params.id);
  const body = request.body;

  const validationError = validateCreateLoan(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
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
    throw err;
  }
}
