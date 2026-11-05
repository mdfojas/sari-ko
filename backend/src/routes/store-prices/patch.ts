import type { FastifyReply, FastifyRequest } from 'fastify';
import { DuplicateStorePriceError, updateStorePrice, type UpdateStorePriceInput } from '../../queries/store-prices/index.js';
import { StoreChangedError } from '../../queries/stores/index.js';
import { isForeignKeyViolation, isRetryableConflict } from '../../shared/pg-errors.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { hasStorePriceUpdate, validateUpdateStorePrice } from './validation.js';

export async function patch(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateStorePriceInput }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  const body = request.body;

  const validationError = validateUpdateStorePrice(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  if (!hasStorePriceUpdate(body)) {
    return reply.code(400).send({ error: 'No updatable fields provided' });
  }

  try {
    const storePrice = await updateStorePrice(id, body);
    if (!storePrice) {
      return reply.code(404).send({ error: 'Store price not found' });
    }
    return storePrice;
  } catch (err) {
    if (err instanceof DuplicateStorePriceError) return reply.code(409).send({ error: err.message });
    if (err instanceof StoreChangedError || isRetryableConflict(err)) {
      return reply.code(409).send({ error: 'That store was just changed. Please try again.' });
    }
    // The store it was about to move to was merged or deleted at that moment; nothing was saved.
    if (isForeignKeyViolation(err)) {
      return reply.code(409).send({ error: 'That store was just changed. Please try again.' });
    }
    throw err;
  }
}
