import type { FastifyReply, FastifyRequest } from 'fastify';
import { findAccountById } from '../../queries/accounts/index.js';
import { toPublicAccount } from '../accounts/serialize.js';

export async function get(request: FastifyRequest, reply: FastifyReply) {
  const account = await findAccountById(request.account!.id);
  if (!account) {
    return reply.code(404).send({ error: 'Account not found' });
  }
  return toPublicAccount(account);
}
