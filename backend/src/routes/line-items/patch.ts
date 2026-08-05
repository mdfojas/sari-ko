import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  InvalidLineItemUpdateError,
  updateLineItem,
  type UpdateLineItemInput,
} from '../../queries/line-items/index.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateLineItemInput }>,
  reply: FastifyReply,
) {
  const id = Number(request.params.id);
  const body = request.body;

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
    if (err instanceof InvalidLineItemUpdateError) {
      return reply.code(400).send({ error: err.message });
    }
    throw err;
  }
}
