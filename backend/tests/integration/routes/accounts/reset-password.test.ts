import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';
import { verifyPassword } from '../../../../src/shared/auth/password.js';

async function createAccount(username: string, role: string, personId: number | null = null) {
  const { rows } = await pool.query(
    `INSERT INTO accounts (username, password_hash, role, person_id) VALUES ($1, 'hash', $2, $3) RETURNING id`,
    [username, role, personId],
  );
  return rows[0].id;
}

async function createPerson(name: string) {
  const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ($1) RETURNING id`, [name]);
  return rows[0].id;
}

describe('PATCH /accounts/:id/password', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns 404 for an id with no matching row', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/accounts/999999/password',
      headers: authHeaderFor('admin'),
      payload: {},
    });
    expect(response.statusCode).toBe(404);
  });

  it('admin resetting a store_owner password with an explicit password succeeds', async () => {
    const id = await createAccount('owner1', 'store_owner');

    const response = await app.inject({
      method: 'PATCH',
      url: `/accounts/${id}/password`,
      headers: authHeaderFor('admin'),
      payload: { password: 'brand-new-pass' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().password).toBe('brand-new-pass');

    const { rows } = await pool.query(`SELECT password_hash FROM accounts WHERE id = $1`, [id]);
    expect(await verifyPassword('brand-new-pass', rows[0].password_hash)).toBe(true);
  });

  it('generates a password when none is supplied', async () => {
    const id = await createAccount('owner1', 'store_owner');

    const response = await app.inject({
      method: 'PATCH',
      url: `/accounts/${id}/password`,
      headers: authHeaderFor('admin'),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(typeof response.json().password).toBe('string');
  });

  it('store_owner resetting a customer password succeeds', async () => {
    const id = await createAccount('cust1', 'customer', await createPerson('Juan Dela Cruz'));

    const response = await app.inject({
      method: 'PATCH',
      url: `/accounts/${id}/password`,
      headers: authHeaderFor('store_owner'),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
  });

  it('store_owner resetting an admin/store_owner password fails with 403', async () => {
    const id = await createAccount('admin1', 'admin');

    const response = await app.inject({
      method: 'PATCH',
      url: `/accounts/${id}/password`,
      headers: authHeaderFor('store_owner'),
      payload: {},
    });

    expect(response.statusCode).toBe(403);
  });
});
