import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';
import { hashPassword } from '../../../../src/shared/auth/password.js';

describe('PATCH /me/password', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'PATCH', url: '/me/password', payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it('rejects an incorrect currentPassword and leaves the stored hash unchanged', async () => {
    const id = await createAccount({
      username: 'owner1',
      role: 'store_owner',
      passwordHash: await hashPassword('correct-horse'),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      payload: { currentPassword: 'wrong-password', newPassword: 'brand-new-pass' },
    });

    expect(response.statusCode).toBe(401);

    const loginWithOld = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner1', password: 'correct-horse' },
    });
    expect(loginWithOld.statusCode).toBe(200);
  });

  it('changes the password when currentPassword is correct, old password stops working', async () => {
    const id = await createAccount({
      username: 'owner1',
      role: 'store_owner',
      passwordHash: await hashPassword('correct-horse'),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      payload: { currentPassword: 'correct-horse', newPassword: 'brand-new-pass' },
    });

    expect(response.statusCode).toBe(204);

    const loginWithNew = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner1', password: 'brand-new-pass' },
    });
    expect(loginWithNew.statusCode).toBe(200);

    const loginWithOld = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'owner1', password: 'correct-horse' },
    });
    expect(loginWithOld.statusCode).toBe(401);
  });

  it('rejects a newPassword under 8 characters', async () => {
    const id = await createAccount({
      username: 'owner1',
      role: 'store_owner',
      passwordHash: await hashPassword('correct-horse'),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
      payload: { currentPassword: 'correct-horse', newPassword: 'short1' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('works identically for a customer account', async () => {
    const id = await createAccount({
      username: 'juan',
      role: 'customer',
      personId: await createPerson('juan'),
      passwordHash: await hashPassword('correct-horse'),
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/me/password',
      headers: authHeaderFor('customer', { accountId: id, username: 'juan' }),
      payload: { currentPassword: 'correct-horse', newPassword: 'brand-new-pass' },
    });

    expect(response.statusCode).toBe(204);
  });
});
