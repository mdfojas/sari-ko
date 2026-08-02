import type { FastifyReply, FastifyRequest } from 'fastify';
import { createProduct, findProductById, isUniqueViolation } from '../../queries/products/index.js';
import { validateCreateProduct, type CreateProductBody } from './validation.js';

export async function post(request: FastifyRequest<{ Body: CreateProductBody }>, reply: FastifyReply) {
  const body = request.body;

  const validationError = validateCreateProduct(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const name = body.name as string;
  const storePrices = body.store_prices ?? [];

  try {
    const productId = await createProduct({ ...body, name, store_prices: storePrices });
    const product = await findProductById(productId);
    return reply.code(201).send(product);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return reply.code(409).send({ error: 'A product with this barcode already exists' });
    }
    throw err;
  }
}
