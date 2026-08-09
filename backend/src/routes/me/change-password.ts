import type { FastifyReply, FastifyRequest } from 'fastify';
import { findAccountById, updatePasswordHash } from '../../queries/accounts/index.js';
import { hashPassword, verifyPassword } from '../../shared/auth/password.js';
import { validateChangePassword, type ChangePasswordBody } from './validation.js';

export async function changePassword(
  request: FastifyRequest<{ Body: ChangePasswordBody }>,
  reply: FastifyReply,
) {
  const validationError = validateChangePassword(request.body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const account = await findAccountById(request.account!.id);
  if (!account) {
    return reply.code(404).send({ error: 'Account not found' });
  }

  const { currentPassword, newPassword } = request.body as Required<ChangePasswordBody>;
  if (!(await verifyPassword(currentPassword, account.password_hash))) {
    return reply.code(401).send({ error: 'Current password is incorrect' });
  }

  await updatePasswordHash(account.id, await hashPassword(newPassword));
  return reply.code(204).send();
}
