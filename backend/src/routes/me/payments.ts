import type { FastifyRequest } from 'fastify';
import { listPaymentsByPersonId } from '../../queries/payments/index.js';

export async function payments(request: FastifyRequest) {
  return listPaymentsByPersonId(request.account!.personId!);
}
