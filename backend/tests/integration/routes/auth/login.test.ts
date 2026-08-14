import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createAccount } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';
import { hashPassword } from '../../../../src/shared/auth/password.js';
import { verifyToken } from '../../../../src/shared/auth/jwt.js';

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns a valid token for correct credentials', async () => {
    const id = await createAccount({
      username: 'owner1',
      role: 'store_owner',
      passwordHash: await hashPassword('correct-horse'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner1', password: 'correct-horse' },
    });

    expect(response.statusCode).toBe(200);
    const { token } = response.json();
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ accountId: id, username: 'owner1', role: 'store_owner' });
  });

  it('rejects a wrong password with 401', async () => {
    await createAccount({
      username: 'owner1',
      role: 'store_owner',
      passwordHash: await hashPassword('correct-horse'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner1', password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a username that does not exist with the same 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'nobody', password: 'whatever1' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('gives the same error body for a wrong password and a nonexistent username', async () => {
    await createAccount({
      username: 'owner1',
      role: 'store_owner',
      passwordHash: await hashPassword('correct-horse'),
    });

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner1', password: 'wrong-password' },
    });
    const noSuchUser = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'nobody', password: 'whatever1' },
    });

    expect(wrongPassword.json()).toEqual(noSuchUser.json());
  });

  it('rejects a request missing username or password with 400', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: {} });
    expect(response.statusCode).toBe(400);
  });
});
