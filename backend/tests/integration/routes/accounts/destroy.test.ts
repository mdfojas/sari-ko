import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

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
    const id = await createAccount({ username: 'owner1', role: 'store_owner' });

    const response = await app.inject({ method: 'DELETE', url: `/accounts/${id}`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(204);
  });

  it('store_owner can delete a customer account', async () => {
    const id = await createAccount({
      username: 'cust1',
      role: 'customer',
      personId: await createPerson('Juan Dela Cruz'),
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/accounts/${id}`,
      headers: authHeaderFor('store_owner'),
    });

    expect(response.statusCode).toBe(204);
  });

  it('store_owner deleting an admin/store_owner account fails with 403', async () => {
    const id = await createAccount({ username: 'admin1', role: 'admin' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/accounts/${id}`,
      headers: authHeaderFor('store_owner'),
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses to delete the only remaining admin account, even by an admin', async () => {
    const id = await createAccount({ username: 'admin1', role: 'admin' });

    const response = await app.inject({ method: 'DELETE', url: `/accounts/${id}`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(409);
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [id]);
    expect(rows).toHaveLength(1);
  });

  it('allows deleting an admin account when another admin still exists', async () => {
    await createAccount({ username: 'admin1', role: 'admin' });
    const secondAdminId = await createAccount({ username: 'admin2', role: 'admin' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/accounts/${secondAdminId}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(204);
  });
});
