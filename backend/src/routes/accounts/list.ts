import type { FastifyRequest } from 'fastify';
import { listAccounts } from '../../queries/accounts/index.js';
import { toPublicAccount } from './serialize.js';

export async function list(request: FastifyRequest) {
  const callerRole = request.account!.role;
  const accounts = await listAccounts(callerRole === 'store_owner' ? ['customer'] : undefined);
  return accounts.map(toPublicAccount);
}
