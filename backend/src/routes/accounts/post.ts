import type { FastifyReply, FastifyRequest } from 'fastify';
import { createAccount, listUsernames, personHasAccount } from '../../queries/accounts/index.js';
import { findPersonById } from '../../queries/persons/index.js';
import { generateRandomPassword, hashPassword } from '../../shared/auth/password.js';
import { generateUsername } from '../../shared/auth/username.js';
import { isUniqueViolation } from '../../shared/pg-errors.js';
import type { Role } from '../../shared/auth/jwt.js';
import { canManageAccountOfRole, validateCreateAccount, type CreateAccountBody } from './validation.js';
import { toPublicAccount } from './serialize.js';

export async function post(request: FastifyRequest<{ Body: CreateAccountBody }>, reply: FastifyReply) {
  const callerRole = request.account!.role;
  const body = request.body;

  const validationError = validateCreateAccount(body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const targetRole = body.role as Role;
  if (!canManageAccountOfRole(callerRole, targetRole)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  let username = body.username;
  if (targetRole === 'customer') {
    const person = await findPersonById(body.person_id as number);
    if (!person) {
      return reply.code(400).send({ error: 'person_id does not reference an existing person' });
    }
    if (await personHasAccount(person.id)) {
      return reply.code(409).send({ error: 'This person already has an account' });
    }
    if (!username) {
      username = generateUsername(person.name, await listUsernames());
    }
  }

  const password = body.password ?? generateRandomPassword();

  try {
    const passwordHash = await hashPassword(password);
    const account = await createAccount({
      username: username as string,
      passwordHash,
      role: targetRole,
      personId: targetRole === 'customer' ? (body.person_id as number) : null,
    });
    return reply.code(201).send({ ...toPublicAccount(account), password });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return reply.code(409).send({ error: 'An account with this username already exists' });
    }
    throw err;
  }
}
