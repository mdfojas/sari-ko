import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, type Role } from './jwt.js';

export interface AuthenticatedAccount {
  id: number;
  role: Role;
  personId: number | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    account?: AuthenticatedAccount;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

// A route opts out of the global default-deny auth hook (see app.ts) only by
// explicitly setting `{ config: { public: true } }` — an omission (a new
// route registered with no preHandler at all) now defaults to "requires
// auth," not "wide open."
export function isPublicRoute(request: FastifyRequest): boolean {
  return request.routeOptions?.config?.public === true;
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = verifyToken(token);
    request.account = { id: payload.accountId, role: payload.role, personId: payload.personId };
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(...roles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.account || !roles.includes(request.account.role)) {
      reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
