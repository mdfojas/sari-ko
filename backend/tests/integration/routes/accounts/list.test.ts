import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createAccount(username: string, role: string, personId: number | null = null) {
  await pool.query(`INSERT INTO accounts (username, password_hash, role, person_id) VALUES ($1, 'hash', $2, $3)`, [
    username,
    role,
    personId,
  ]);
}

async function createPerson(name: string) {
  const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ($1) RETURNING id`, [name]);
  return rows[0].id;
}

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
    await createAccount('admin1', 'admin');
    await createAccount('owner1', 'store_owner');
    await createAccount('cust1', 'customer', await createPerson('Juan Dela Cruz'));

    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(3);
  });

  it('store_owner sees only customer accounts', async () => {
    await createAccount('admin1', 'admin');
    await createAccount('owner1', 'store_owner');
    await createAccount('cust1', 'customer', await createPerson('Juan Dela Cruz'));

    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('store_owner') });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].username).toBe('cust1');
  });

  it('never includes password_hash', async () => {
    await createAccount('admin1', 'admin');

    const response = await app.inject({ method: 'GET', url: '/accounts', headers: authHeaderFor('admin') });

    expect(response.json()[0].password_hash).toBeUndefined();
  });
});
