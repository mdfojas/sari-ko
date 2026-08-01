import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createProduct,
  findProductById,
  isUniqueViolation,
  type CreateStorePriceInput,
} from '../../queries/products/index.js';

interface CreateProductBody {
  name?: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  store_prices?: CreateStorePriceInput[];
}

export async function post(request: FastifyRequest<{ Body: CreateProductBody }>, reply: FastifyReply) {
  const body = request.body;
  const storePrices = body.store_prices ?? [];

  if (!body.name) {
    return reply.code(400).send({ error: 'name is required' });
  }
  if (storePrices.length < 1) {
    return reply.code(400).send({ error: 'At least one store price is required' });
  }
  if (!storePrices.some((sp) => sp.selected)) {
    return reply.code(400).send({ error: 'One store price must be marked as selected' });
  }

  const name = body.name;

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
