import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLineItemById } from '../../queries/line-items/index.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const lineItem = await findLineItemById(Number(request.params.id));
  if (!lineItem) {
    return reply.code(404).send({ error: 'Line item not found' });
  }
  return lineItem;
}
