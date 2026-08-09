import type { FastifyRequest } from 'fastify';
import { getLedgerForPerson } from '../../queries/persons/index.js';

export async function ledger(request: FastifyRequest) {
  return getLedgerForPerson(request.account!.personId!);
}
