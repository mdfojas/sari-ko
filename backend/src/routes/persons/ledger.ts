import type { FastifyRequest } from 'fastify';
import { getLedgerForPerson } from '../../queries/persons/index.js';

export async function ledger(request: FastifyRequest<{ Params: { id: string } }>) {
  return getLedgerForPerson(Number(request.params.id));
}
