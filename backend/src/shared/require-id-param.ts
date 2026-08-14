import type { FastifyReply } from 'fastify';

// TypeScript's `Params: { id: string }` only checks shape — it doesn't stop
// `GET /products/abc` from reaching a handler with `id: "abc"`, which
// `Number()` silently turns into `NaN`. That then hits the database as an
// invalid integer, surfacing as an unhandled 500 instead of a clear 400.
export function requireIdParam(value: string, reply: FastifyReply): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    reply.code(400).send({ error: 'id must be a positive integer' });
    return null;
  }
  return id;
}
