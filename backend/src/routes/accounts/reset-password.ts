import type { FastifyReply, FastifyRequest } from 'fastify';
import { findAccountById, updatePasswordHash } from '../../queries/accounts/index.js';
import { generateRandomPassword, hashPassword, validatePasswordStrength } from '../../shared/auth/password.js';
import { canManageAccountOfRole } from './validation.js';

export interface ResetPasswordBody {
  password?: string;
}

export async function resetPassword(
  request: FastifyRequest<{ Params: { id: string }; Body: ResetPasswordBody }>,
  reply: FastifyReply,
) {
  const callerRole = request.account!.role;
  const account = await findAccountById(Number(request.params.id));
  if (!account) {
    return reply.code(404).send({ error: 'Account not found' });
  }
  if (!canManageAccountOfRole(callerRole, account.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  const { password: suppliedPassword } = request.body ?? {};
  if (suppliedPassword !== undefined && !validatePasswordStrength(suppliedPassword)) {
    return reply.code(400).send({ error: 'password must be at least 8 characters' });
  }

  const password = suppliedPassword ?? generateRandomPassword();
  await updatePasswordHash(account.id, await hashPassword(password));

  return reply.code(200).send({ password });
}
