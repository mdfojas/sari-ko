import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /me/balance', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/balance' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects admin/store_owner accounts with 403', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/balance', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(403);
  });

  it('returns the same balance as GET /persons/:id/balance for the linked person', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });
    await pool.query(`INSERT INTO payments (person_id, amount) VALUES ($1, 500)`, [personId]);

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me/balance',
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/persons/${personId}/balance`,
      headers: authHeaderFor('admin'),
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual(adminResponse.json());
  });
});
