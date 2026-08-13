import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteLineItem, isLastRemainingLineItem } from '../../queries/line-items/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  if (await isLastRemainingLineItem(id)) {
    return reply
      .code(400)
      .send({ error: 'This is the last line item on its loan — use DELETE /loans/:id to remove the whole loan instead' });
  }

  const rowCount = await deleteLineItem(id);
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Line item not found' });
  }
  return reply.code(204).send();
}
