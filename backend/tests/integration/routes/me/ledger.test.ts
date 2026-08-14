import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /me/ledger', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/ledger' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects admin/store_owner accounts with 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/me/ledger',
      headers: authHeaderFor('store_owner'),
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns the same data as GET /persons/:id/ledger for the linked person', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });
    await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]).then(({ rows }) =>
      pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Rice', 500)`, [
        rows[0].id,
      ]),
    );

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me/ledger',
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/persons/${personId}/ledger`,
      headers: authHeaderFor('admin'),
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual(adminResponse.json());
  });
});
