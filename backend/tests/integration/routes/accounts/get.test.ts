import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /accounts/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns 404 for an id with no matching row, regardless of caller role', async () => {
    const response = await app.inject({ method: 'GET', url: '/accounts/999999', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(404);
  });

  it('returns 400, not a raw 500, for a non-numeric id', async () => {
    const response = await app.inject({ method: 'GET', url: '/accounts/abc', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(400);
  });

  it('admin can fetch any account', async () => {
    const id = await createAccount({ username: 'admin1', role: 'admin' });

    const response = await app.inject({ method: 'GET', url: `/accounts/${id}`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json().username).toBe('admin1');
  });

  it('store_owner fetching a customer account succeeds', async () => {
    const id = await createAccount({
      username: 'cust1',
      role: 'customer',
      personId: await createPerson('Juan Dela Cruz'),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/accounts/${id}`,
      headers: authHeaderFor('store_owner'),
    });

    expect(response.statusCode).toBe(200);
  });

  it('store_owner fetching an admin/store_owner account fails with 403, not 404', async () => {
    const id = await createAccount({ username: 'admin1', role: 'admin' });

    const response = await app.inject({
      method: 'GET',
      url: `/accounts/${id}`,
      headers: authHeaderFor('store_owner'),
    });

    expect(response.statusCode).toBe(403);
  });
});
