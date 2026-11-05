import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../helpers.js';
import { pool } from '../../../src/shared/db.js';
import { buildApp } from '../../../src/app.js';
import { resetDatabase } from '../../reset-db.js';

// Backstop for any route a validator doesn't cover: Postgres rejects bad input
// (a NUL byte, an out-of-range number) with a "data exception" error, which used
// to surface as a 500. It is the caller's mistake, so it should be a 400.
describe('bad input is a 400, not a 500', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const admin = authHeaderFor('admin');

  it.each([
    ['person search', '/persons/search?q=%00'],
    ['product search', '/products/search?q=%00'],
    ['barcode lookup', '/products/barcode/%00'],
  ])('a NUL byte in the %s', async (_label, url) => {
    const response = await app.inject({ method: 'GET', url, headers: admin });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid input' });
  });

  it('a NUL byte in a new persons name', async () => {
    const response = await app.inject({ method: 'POST', url: '/persons', headers: admin, payload: { name: 'a\u0000b' } });
    expect(response.statusCode).toBe(400);
  });

  it.each(['/loans/3000000000', '/persons/3000000000', '/products/3000000000', '/accounts/3000000000'])(
    'an id past the INTEGER ceiling (%s)',
    async (url) => {
      const response = await app.inject({ method: 'GET', url, headers: admin });
      expect(response.statusCode).toBe(400);
    },
  );

  it.each(['/persons/3000000000/loans', '/persons/3000000000/payments'])('an out-of-range person id on POST %s', async (url) => {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: admin,
      payload: url.endsWith('loans') ? { line_items: [{ description: 'x', amount: 1 }] } : { amount: 100 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("leaves Fastify's own 400s (malformed JSON) in their usual shape", async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/persons',
      headers: { ...admin, 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('FST_ERR_CTP_INVALID_JSON_BODY');
  });

  it('still returns 401 and 403 and 404 as before', async () => {
    expect((await app.inject({ method: 'GET', url: '/persons' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('customer') })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/persons/999999', headers: admin })).statusCode).toBe(404);
  });

  it('logs the rejection (code and route only, never the input) before replying 400', async () => {
    const lines: string[] = [];
    const logged = buildApp({ logger: { level: 'warn', stream: { write: (line: string) => void lines.push(line) } } });
    await logged.ready();

    const response = await logged.inject({ method: 'GET', url: '/persons/search?q=secret%00value', headers: admin });
    await logged.close();

    expect(response.statusCode).toBe(400);
    const entry = lines.map((l) => JSON.parse(l)).find((l) => l.msg === 'Postgres rejected request input; replying 400');
    expect(entry).toMatchObject({ code: '22021', route: '/persons/search' });
    expect(lines.join('')).not.toContain('secret');
  });
});
