import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /accounts', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/accounts' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer account', async () => {
    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('customer') });
    expect(response.statusCode).toBe(403);
  });

  it('admin sees every account', async () => {
    await createAccount({ username: 'admin1', role: 'admin' });
    await createAccount({ username: 'owner1', role: 'store_owner' });
    await createAccount({ username: 'cust1', role: 'customer', personId: await createPerson('Juan Dela Cruz') });

    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(3);
  });

  it('store_owner sees only customer accounts', async () => {
    await createAccount({ username: 'admin1', role: 'admin' });
    await createAccount({ username: 'owner1', role: 'store_owner' });
    await createAccount({ username: 'cust1', role: 'customer', personId: await createPerson('Juan Dela Cruz') });

    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('store_owner') });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].username).toBe('cust1');
  });

  it('never includes password_hash', async () => {
    await createAccount({ username: 'admin1', role: 'admin' });

    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('admin') });

    expect(response.json()[0].password_hash).toBeUndefined();
  });
});
