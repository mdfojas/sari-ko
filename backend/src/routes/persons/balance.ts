import type { FastifyRequest } from 'fastify';
import { getBalanceForPerson } from '../../queries/persons/index.js';

export async function balance(request: FastifyRequest<{ Params: { id: string } }>) {
  const balance = await getBalanceForPerson(Number(request.params.id));
  return { balance };
}
