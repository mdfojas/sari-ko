import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply } from 'fastify';
import { requireIdParam } from '../../../src/shared/require-id-param.js';

const replyStub = () => {
  const send = vi.fn();
  const code = vi.fn().mockReturnValue({ send });
  return { reply: { code } as unknown as FastifyReply, code, send };
};

describe('requireIdParam', () => {
  it.each([['1', 1], ['42', 42], ['2147483647', 2_147_483_647]])('accepts "%s"', (value, expected) => {
    const { reply, code } = replyStub();
    expect(requireIdParam(value, reply)).toBe(expected);
    expect(code).not.toHaveBeenCalled();
  });

  // The ids are INTEGER columns: a larger number would reach Postgres as an
  // out-of-range error and come back as a 500.
  it.each(['abc', '', '0', '-1', '1.5', '2147483648', '3000000000', '1e10'])('rejects "%s" with a 400', (value) => {
    const { reply, code, send } = replyStub();
    expect(requireIdParam(value, reply)).toBeNull();
    expect(code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ error: 'id must be a positive integer' });
  });
});
