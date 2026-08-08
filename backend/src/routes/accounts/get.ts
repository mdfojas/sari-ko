import type { FastifyReply, FastifyRequest } from 'fastify';
import { findAccountById } from '../../queries/accounts/index.js';
import { canManageAccountOfRole } from './validation.js';
import { toPublicAccount } from './serialize.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const callerRole = request.account!.role;
  const account = await findAccountById(Number(request.params.id));
  if (!account) {
    return reply.code(404).send({ error: 'Account not found' });
  }
  if (!canManageAccountOfRole(callerRole, account.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  return toPublicAccount(account);
}
