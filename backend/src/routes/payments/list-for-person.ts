import type { FastifyRequest } from 'fastify';
import { listPaymentsByPersonId } from '../../queries/payments/index.js';

export async function listForPerson(request: FastifyRequest<{ Params: { id: string } }>) {
  return listPaymentsByPersonId(Number(request.params.id));
}
