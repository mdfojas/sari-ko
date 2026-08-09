import type { FastifyReply, FastifyRequest } from 'fastify';
import { findAccountByUsername } from '../../queries/accounts/index.js';
import { verifyPassword } from '../../shared/auth/password.js';
import { signToken } from '../../shared/auth/jwt.js';
import { validateLogin, type LoginBody } from './validation.js';

const INVALID_CREDENTIALS_ERROR = { error: 'Invalid username or password' };

export async function login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
  const validationError = validateLogin(request.body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const { username, password } = request.body as Required<LoginBody>;
  const account = await findAccountByUsername(username);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    return reply.code(401).send(INVALID_CREDENTIALS_ERROR);
  }

  const token = signToken({
    accountId: account.id,
    username: account.username,
    role: account.role,
    personId: account.person_id,
  });
  return reply.code(200).send({ token });
}
