import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /me', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/me' });
    expect(response.statusCode).toBe(401);
  });

  it('returns the authenticated account own info', async () => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: authHeaderFor('store_owner', { accountId: id, username: 'owner1' }),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ id, username: 'owner1', role: 'store_owner', person_id: null });
    expect(body.password_hash).toBeUndefined();
  });

  it('works identically for a customer account', async () => {
    const personId = await createPerson('Juan');
    const id = await createAccount({ username: 'juan', role: 'customer', personId });

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: authHeaderFor('customer', { accountId: id, username: 'juan', personId }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id, username: 'juan', role: 'customer', person_id: personId });
  });
});
