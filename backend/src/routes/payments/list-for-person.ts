import type { FastifyReply, FastifyRequest } from 'fastify';
import { listPaymentsByPersonId } from '../../queries/payments/index.js';
import { requireIdParam } from '../../shared/require-id-param.js';

export async function listForPerson(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const id = requireIdParam(request.params.id, reply);
  if (id === null) return;
  return listPaymentsByPersonId(id);
}
