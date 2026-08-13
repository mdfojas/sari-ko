import type { FastifyReply, FastifyRequest } from 'fastify';
import { findAccountByUsername, type Account } from '../../queries/accounts/index.js';
import { verifyPassword } from '../../shared/auth/password.js';
import { signToken } from '../../shared/auth/jwt.js';
import { validateLogin, type LoginBody } from './validation.js';

const INVALID_CREDENTIALS_ERROR = { error: 'Invalid username or password' };

// A syntactically valid bcrypt hash with no real password behind it. When the
// username doesn't exist, we still run a full bcrypt.compare against this
// instead of short-circuiting — otherwise an unknown username would respond
// measurably faster than a known one with a wrong password, letting an
// attacker enumerate valid usernames by timing alone even though the
// response body is identical either way.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Wpr1r1nMHKXhaU3v3fzz6ELc5cRPu';

export function resolveHashToCompare(account: Account | null): string {
  return account?.password_hash ?? DUMMY_HASH;
}

export async function login(request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) {
  const validationError = validateLogin(request.body);
  if (validationError) {
    return reply.code(400).send({ error: validationError });
  }

  const { username, password } = request.body as Required<LoginBody>;
  const account = await findAccountByUsername(username);
  const passwordMatches = await verifyPassword(password, resolveHashToCompare(account));
  if (!account || !passwordMatches) {
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
