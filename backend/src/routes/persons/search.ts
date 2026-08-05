import type { FastifyRequest } from 'fastify';
import { searchPersons } from '../../queries/persons/index.js';

export async function search(request: FastifyRequest<{ Querystring: { q?: string } }>) {
  return searchPersons(request.query.q ?? '');
}
