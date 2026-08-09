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
});
