import type { FastifyReply, FastifyRequest } from 'fastify';
import { updatePasswordHash } from '../../queries/accounts/index.js';
import {
  generateRandomPassword,
  hashPassword,
  passwordStrengthMessage,
  validatePasswordStrength,
} from '../../shared/auth/password.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { resolveManageableAccount } from './manageable-account.js';

export interface ResetPasswordBody {
  password?: string;
}

export async function resetPassword(
  request: FastifyRequest<{ Params: { id: string }; Body: ResetPasswordBody }>,
  reply: FastifyReply,
) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  const result = await resolveManageableAccount(id, request.account!.role);
  if (!result.ok) {
    return reply.code(result.status).send({ error: result.status === 404 ? 'Account not found' : 'Forbidden' });
  }
  const { account } = result;

  const { password: suppliedPassword } = request.body ?? {};
  if (suppliedPassword !== undefined && !validatePasswordStrength(suppliedPassword)) {
    return reply.code(400).send({ error: passwordStrengthMessage() });
  }

  const password = suppliedPassword ?? generateRandomPassword();
  await updatePasswordHash(account.id, await hashPassword(password));

  return reply.code(200).send({ password });
}
