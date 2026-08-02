import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  findProductById,
  isUniqueViolation,
  updateProduct,
  type UpdateProductInput,
} from '../../queries/products/index.js';
import { hasProductUpdate } from './validation.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateProductInput }>,
  reply: FastifyReply,
) {
  const id = Number(request.params.id);
  const body = request.body;

  if (!hasProductUpdate(body)) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  try {
    const rowCount = await updateProduct(id, body);
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Product not found' });
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      return reply.code(409).send({ error: 'A product with this barcode already exists' });
    }
    throw err;
  }

  return findProductById(id);
}
