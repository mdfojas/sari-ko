import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductById } from '../../queries/products/index.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const product = await findProductById(Number(request.params.id));
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }
  return product;
}
