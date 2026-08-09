import type { FastifyRequest } from 'fastify';
import { searchProducts } from '../../queries/products/index.js';
import { serializeProduct } from './serialize.js';

export async function search(request: FastifyRequest<{ Querystring: { q?: string } }>) {
  const products = await searchProducts(request.query.q ?? '');
  return products.map((product) => serializeProduct(product, request.account!.role));
}
