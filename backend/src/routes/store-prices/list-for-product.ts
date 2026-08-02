import type { FastifyRequest } from 'fastify';
import { listStorePricesByProductId } from '../../queries/store-prices/index.js';

export async function listForProduct(request: FastifyRequest<{ Params: { id: string } }>) {
  return listStorePricesByProductId(Number(request.params.id));
}
