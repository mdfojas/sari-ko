import type { FastifyReply, FastifyRequest } from 'fastify';
import { updateUsername } from '../../queries/accounts/index.js';
import { isUniqueViolation } from '../../shared/pg-errors.js';
import { validateChangeUsername, type ChangeUsernameBody } from './validation.js';

export async function changeUsername(
  request: FastifyRequest<{ Body: ChangeUsernameBody }>,
  reply: FastifyReply,
) {
  const validationError = validateChangeUsername(request.body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  try {
    await updateUsername(request.account!.id, request.body.username as string);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return reply.code(409).send({ error: 'That username is already taken' });
    }
    throw err;
  }

  return reply.code(204).send();
}
