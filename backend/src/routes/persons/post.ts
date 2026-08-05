import type { FastifyReply, FastifyRequest } from 'fastify';
import { createPerson } from '../../queries/persons/index.js';
import { validateCreatePerson, type CreatePersonBody } from './validation.js';

export async function post(request: FastifyRequest<{ Body: CreatePersonBody }>, reply: FastifyReply) {
  const body = request.body;

  const validationError = validateCreatePerson(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const person = await createPerson({ name: body.name as string, contact: body.contact });
  return reply.code(201).send(person);
}
