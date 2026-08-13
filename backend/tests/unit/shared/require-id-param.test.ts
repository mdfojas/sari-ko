import { describe, expect, it } from 'vitest';
import { requireIdParam } from '../../../src/shared/require-id-param.js';

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
  } as unknown as import('fastify').FastifyReply;
  return { reply, state };
}

describe('requireIdParam', () => {
  it('returns the parsed number for a valid positive integer string', () => {
    const { reply } = fakeReply();
    expect(requireIdParam('42', reply)).toBe(42);
  });

  it('returns null and sends 400 for a non-numeric string', () => {
    const { reply, state } = fakeReply();
    expect(requireIdParam('abc', reply)).toBeNull();
    expect(state.statusCode).toBe(400);
  });

  it('returns null and sends 400 for a decimal', () => {
    const { reply, state } = fakeReply();
    expect(requireIdParam('1.5', reply)).toBeNull();
    expect(state.statusCode).toBe(400);
  });

  it('returns null and sends 400 for zero or negative numbers', () => {
    const { reply, state } = fakeReply();
    expect(requireIdParam('0', reply)).toBeNull();
    expect(state.statusCode).toBe(400);

    const { reply: reply2, state: state2 } = fakeReply();
    expect(requireIdParam('-5', reply2)).toBeNull();
    expect(state2.statusCode).toBe(400);
  });
});
