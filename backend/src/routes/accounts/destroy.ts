import type { FastifyReply, FastifyRequest } from 'fastify';
import { deleteAccount, findAccountById } from '../../queries/accounts/index.js';
import { canManageAccountOfRole } from './validation.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const callerRole = request.account!.role;
  const account = await findAccountById(Number(request.params.id));
  if (!account) {
    return reply.code(404).send({ error: 'Account not found' });
  }
  if (!canManageAccountOfRole(callerRole, account.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  await deleteAccount(account.id);
  return reply.code(204).send();
}
