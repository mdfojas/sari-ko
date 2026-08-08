import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { requireAuth, requireRole } from '../../../../src/shared/auth/guards.js';
import { signToken } from '../../../../src/shared/auth/jwt.js';

function fakeRequest(headers: Record<string, string> = {}) {
  return { headers, account: undefined } as unknown as FastifyRequest & {
    account?: { id: number; role: string; personId: number | null };
  };
}

function fakeReply() {
  const state: { statusCode?: number; body?: unknown } = {};
  const reply = {
    code(code: number) {
      state.statusCode = code;
      return reply;
    },
    send(body: unknown) {
      state.body = body;
      return reply;
    },
  } as unknown as FastifyReply;
  return { reply, state };
}

describe('requireAuth', () => {
  it('rejects a request with no Authorization header with 401', async () => {
    const request = fakeRequest();
    const { reply, state } = fakeReply();

    await requireAuth(request, reply);

    expect(state.statusCode).toBe(401);
  });

  it('rejects a request with an invalid token with 401', async () => {
    const request = fakeRequest({ authorization: 'Bearer garbage' });
    const { reply, state } = fakeReply();

    await requireAuth(request, reply);

    expect(state.statusCode).toBe(401);
  });

  it('attaches request.account for a valid token', async () => {
    const token = signToken({ accountId: 1, username: 'owner1', role: 'store_owner', personId: null });
    const request = fakeRequest({ authorization: `Bearer ${token}` });
    const { reply, state } = fakeReply();

    await requireAuth(request, reply);

    expect(state.statusCode).toBeUndefined();
    expect(request.account).toEqual({ id: 1, role: 'store_owner', personId: null });
  });
});

describe('requireRole', () => {
  it('allows an account whose role is in the allowed list', async () => {
    const request = fakeRequest();
    request.account = { id: 1, role: 'admin', personId: null };
    const { reply, state } = fakeReply();

    await requireRole('admin', 'store_owner')(request, reply);

    expect(state.statusCode).toBeUndefined();
  });

  it('rejects an account whose role is not in the allowed list with 403', async () => {
    const request = fakeRequest();
    request.account = { id: 1, role: 'customer', personId: 5 };
    const { reply, state } = fakeReply();

    await requireRole('admin', 'store_owner')(request, reply);

    expect(state.statusCode).toBe(403);
  });
});
