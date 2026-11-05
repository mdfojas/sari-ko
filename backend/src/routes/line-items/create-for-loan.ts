import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AmountTooLargeError,
  assertLoanTotalWithinLimit,
  insertLineItem,
  lockLoan,
  ProductNotFoundError,
  type CreateLineItemInput,
} from '../../queries/line-items/index.js';
import { pool } from '../../shared/db.js';
import { isForeignKeyViolation } from '../../shared/pg-errors.js';
import { withTransaction } from '../../shared/transaction.js';
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
    // In a transaction so an item that would push the loan past the INTEGER
    // ceiling is rolled back rather than saved.
    const lineItem = await withTransaction(pool, async (client) => {
      if (!(await lockLoan(client, loanId))) return null;
      const inserted = await insertLineItem(client, loanId, body as CreateLineItemInput);
      await assertLoanTotalWithinLimit(client, loanId);
      return inserted;
    });
    if (lineItem === null) return reply.code(404).send({ error: 'Loan not found' });
    return reply.code(201).send(lineItem);
  } catch (err) {
    if (err instanceof ProductNotFoundError || err instanceof AmountTooLargeError) {
      return reply.code(400).send({ error: err.message });
    }
    if (isForeignKeyViolation(err)) {
      return reply.code(404).send({ error: 'Loan not found' });
    }
    throw err;
  }
}
