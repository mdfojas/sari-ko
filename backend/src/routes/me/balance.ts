import type { FastifyRequest } from 'fastify';
import { getBalanceForPerson } from '../../queries/persons/index.js';

export async function balance(request: FastifyRequest) {
  const balance = await getBalanceForPerson(request.account!.personId!);
  return { balance };
}
