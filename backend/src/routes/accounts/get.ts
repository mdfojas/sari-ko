import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireIdParam } from '../../shared/require-id-param.js';
import { resolveManageableAccount } from './manageable-account.js';
import { toPublicAccount } from './serialize.js';

export async function get(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;

  const result = await resolveManageableAccount(id, request.account!.role);
  if (!result.ok) {
    return reply.code(result.status).send({ error: result.status === 404 ? 'Account not found' : 'Forbidden' });
  }
  return toPublicAccount(result.account);
}
