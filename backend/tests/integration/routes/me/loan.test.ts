import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createLoan(personId: number) {
  const { rows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]);
  return rows[0].id;
}

describe('GET /me/loans/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/loans/1' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects admin/store_owner accounts with 403', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/loans/1', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for a loan that does not exist', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });

    const response = await app.inject({
      method: 'GET',
      url: '/me/loans/999999',
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400, not a raw 500, for a non-numeric loan id', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });

    const response = await app.inject({
      method: 'GET',
      url: '/me/loans/abc',
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 403, not the data, for a loan belonging to a different person', async () => {
    const ownPersonId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId: ownPersonId });
    const otherPersonId = await createPerson('Maria');
    const otherLoanId = await createLoan(otherPersonId);

    const response = await app.inject({
      method: 'GET',
      url: `/me/loans/${otherLoanId}`,
      headers: authHeaderFor('customer', { accountId, personId: ownPersonId, username: 'juan' }),
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns the same data as GET /loans/:id for the caller own loan', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });
    const loanId = await createLoan(personId);

    const meResponse = await app.inject({
      method: 'GET',
      url: `/me/loans/${loanId}`,
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/loans/${loanId}`,
      headers: authHeaderFor('admin'),
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual(adminResponse.json());
  });
});
