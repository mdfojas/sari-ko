import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

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

describe('DELETE /accounts/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns 404 for an id with no matching row', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/accounts/999999',
      headers: authHeaderFor('admin'),
    });
    expect(response.statusCode).toBe(404);
  });

  it('admin can delete any account', async () => {
    const id = await createAccount('owner1', 'store_owner');

    const response = await app.inject({ method: 'DELETE', url: `/accounts/${id}`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(204);
  });

  it('store_owner can delete a customer account', async () => {
    const id = await createAccount('cust1', 'customer', await createPerson('Juan Dela Cruz'));

    const response = await app.inject({
      method: 'DELETE',
      url: `/accounts/${id}`,
      headers: authHeaderFor('store_owner'),
    });

    expect(response.statusCode).toBe(204);
  });

  it('store_owner deleting an admin/store_owner account fails with 403', async () => {
    const id = await createAccount('admin1', 'admin');

    const response = await app.inject({
      method: 'DELETE',
      url: `/accounts/${id}`,
      headers: authHeaderFor('store_owner'),
    });

    expect(response.statusCode).toBe(403);
  });
});
