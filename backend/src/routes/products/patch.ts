import type { FastifyReply, FastifyRequest } from 'fastify';
import { findProductById, updateProduct, type UpdateProductInput } from '../../queries/products/index.js';
import { findStorePriceById } from '../../queries/store-prices/index.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { hasProductUpdate, normalizeBarcode, validateUpdateProduct } from './validation.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateProductInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  const validationError = validateUpdateProduct(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }
  if (!hasProductUpdate(body)) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  // The sale-price source must be one of THIS product's own store prices. The
  // column is only a foreign key to store_prices(id), so without this check a
  // nonexistent id is a raw 500 and another product's price is silently accepted.
  if (body.selected_store_price_id !== undefined) {
    if (!(await findProductById(id))) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    const storePrice = await findStorePriceById(body.selected_store_price_id);
    if (!storePrice) {
      return reply.code(400).send({ error: 'selected_store_price_id does not reference an existing store price' });
    }
    if (storePrice.product_id !== id) {
      return reply.code(400).send({ error: 'selected_store_price_id must be a store price that belongs to this product' });
    }
  }

  try {
    const rowCount = await updateProduct(id, { ...body, barcode: normalizeBarcode(body.barcode) });
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Product not found' });
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      return reply.code(409).send({ error: 'A product with this barcode already exists' });
    }
    // The store price was deleted between the check above and this update.
    if (isForeignKeyViolation(err)) {
      return reply.code(400).send({ error: 'selected_store_price_id does not reference an existing store price' });
    }
    throw err;
  }

  return findProductById(id);
}
