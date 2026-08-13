import type { FastifyReply, FastifyRequest } from 'fastify';
import { getLedgerForPerson } from '../../queries/persons/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function ledger(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  return getLedgerForPerson(id);
}
