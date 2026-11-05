import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /stores (add a store)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const post = (payload?: unknown, role: 'admin' | 'store_owner' | 'customer' | null = 'admin') =>
    app.inject({
      method: 'POST',
      url: '/stores',
      ...(role ? { headers: authHeaderFor(role) } : {}),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  const storeNames = async () => (await pool.query(`SELECT name FROM stores ORDER BY name COLLATE "C"`)).rows.map((r) => r.name);

  it('rejects a request with no auth', async () => {
    expect((await post({ name: 'SM' }, null)).statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    expect((await post({ name: 'SM' }, 'customer')).statusCode).toBe(403);
  });

  it.each(['admin', 'store_owner'] as const)('is available to a %s', async (role) => {
    expect((await post({ name: `Store of ${role}` }, role)).statusCode).toBe(201);
  });

  it('creates the store, with no prices, and returns it', async () => {
    const response = await post({ name: 'Public Market' });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: expect.any(Number), name: 'Public Market' });
    expect(await storeNames()).toEqual(['Public Market']);
  });

  it('trims the name', async () => {
    expect((await post({ name: '  Public Market  ' })).json().name).toBe('Public Market');
  });

  it('refuses a name that already exists, ignoring case and surrounding spaces, and creates nothing', async () => {
    await post({ name: 'Puregold' });

    for (const name of ['Puregold', 'puregold', 'PUREGOLD', '  Puregold ']) {
      const response = await post({ name });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('A store called "Puregold" already exists');
    }
    expect(await storeNames()).toEqual(['Puregold']);
  });

  it.each([
    ['no body', undefined],
    ['a missing name', {}],
    ['a numeric name', { name: 5 }],
    ['a blank name', { name: '   ' }],
    ['an over-long name', { name: 'x'.repeat(5000) }],
    ['a NUL byte', { name: 'a\u0000b' }],
    ['an invisible-only name', { name: '\u200B' }],
  ])('returns 400, not a 500, for %s, and creates nothing', async (_label, payload) => {
    expect((await post(payload)).statusCode).toBe(400);
    expect(await storeNames()).toEqual([]);
  });
});
