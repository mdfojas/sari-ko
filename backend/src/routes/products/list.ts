import type { FastifyRequest } from 'fastify';
import { listProducts } from '../../queries/products/index.js';
import { serializeProduct } from './serialize.js';

export async function list(request: FastifyRequest) {
  const products = await listProducts();
  return products.map((product) => serializeProduct(product, request.account!.role));
}
