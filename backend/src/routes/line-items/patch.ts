import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AmountTooLargeError,
  InvalidLineItemUpdateError,
  updateLineItem,
  type UpdateLineItemInput,
} from '../../queries/line-items/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { validateUpdateLineItem } from './validation.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLineItemInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  const validationError = validateUpdateLineItem(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  if (body.description === undefined && body.quantity === undefined && body.amount === undefined) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  try {
    const lineItem = await updateLineItem(id, body);
    if (!lineItem) {
      return reply.code(404).send({ error: 'Line item not found' });
    }
    return lineItem;
  } catch (err) {
    if (err instanceof InvalidLineItemUpdateError || err instanceof AmountTooLargeError) {
      return reply.code(400).send({ error: err.message });
    }
    throw err;
  }
}
