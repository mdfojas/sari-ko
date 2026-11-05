import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /me/username', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/me/username', payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it('changes the username, no current password required', async () => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/username',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      payload: { username: 'owner-renamed' },
    });

    expect(response.statusCode).toBe(204);

    const { rows } = await pool.query(`SELECT username FROM accounts WHERE id = $1`, [id]);
    expect(rows[0].username).toBe('owner-renamed');
  });

  it('rejects a username already taken by another account with 409', async () => {
    await createAccount({ username: 'taken-name', role: 'store_owner' });
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/username',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      payload: { username: 'taken-name' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects a missing username with 400', async () => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/username',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  async function patchAs(id: number, payload?: unknown) {
    return app.inject({
      method: 'PATCH',
      url: '/me/username',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  }

  it('returns 400, not a 500, when there is no body at all', async () => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });
    expect((await patchAs(id)).statusCode).toBe(400);
  });

  it.each([
    ['a number', { username: 123 }],
    ['blank spaces', { username: '   ' }],
    ['an over-long name', { username: 'x'.repeat(5000) }],
    ['a NUL byte', { username: 'a\u0000b' }],
  ])('rejects %s and leaves the username unchanged', async (_label, payload) => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });
    expect((await patchAs(id, payload)).statusCode).toBe(400);
    const { rows } = await pool.query(`SELECT username FROM accounts WHERE id = $1`, [id]);
    expect(rows[0].username).toBe('owner1');
  });

  it('stores the trimmed username', async () => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });
    expect((await patchAs(id, { username: '  tidy-name  ' })).statusCode).toBe(204);
    const { rows } = await pool.query(`SELECT username FROM accounts WHERE id = $1`, [id]);
    expect(rows[0].username).toBe('tidy-name');
  });
});
