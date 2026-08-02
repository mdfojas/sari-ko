import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductByBarcode } from '../../../queries/products/index.js';

export async function get(request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) {
  const product = await findProductByBarcode(request.params.code);
  if (!product) {
    return reply.code(404).send({ error: 'Product not found' });
  }
  return product;
}
