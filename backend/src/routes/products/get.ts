import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductById } from '../../queries/products/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const product = await findProductById(id);
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }
  return product;
}
