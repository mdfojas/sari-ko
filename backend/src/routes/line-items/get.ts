import type { FastifyReply, FastifyRequest } from 'fastify';
import { findLineItemById } from '../../queries/line-items/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const lineItem = await findLineItemById(id);
  if (!lineItem) {
    return reply.code(404).send({ error: 'Line item not found' });
  }
  return lineItem;
}
