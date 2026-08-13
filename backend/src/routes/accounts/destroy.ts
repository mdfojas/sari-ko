import type { FastifyReply, FastifyRequest } from 'fastify';
import { countAccountsByRole, deleteAccount } from '../../queries/accounts/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';
import { resolveManageableAccount } from './manageable-account.js';

export async function destroy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  const result = await resolveManageableAccount(id, request.account!.role);
  if (!result.ok) {
    return reply.code(result.status).send({ error: result.status === 404 ? 'Account not found' : 'Forbidden' });
  }
  const { account } = result;

  if (account.role === 'admin' && (await countAccountsByRole('admin')) <= 1) {
    return reply.code(409).send({ error: 'Cannot delete the last remaining admin account' });
  }

  await deleteAccount(account.id);
  return reply.code(204).send();
}
