import type { FastifyRequest } from 'fastify';
import { searchProducts } from '../../queries/products/index.js';

export async function search(request: FastifyRequest<{ Querystring: { q?: string } }>) {
  return searchProducts(request.query.q ?? '');
}
