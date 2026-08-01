import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteProduct } from '../../queries/products/index.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const rowCount = await deleteProduct(Number(request.params.id));
  if (rowCount === 0) {
    return reply.code(404).send({ error: 'Product not found' });
  }
  return reply.code(204).send();
}
