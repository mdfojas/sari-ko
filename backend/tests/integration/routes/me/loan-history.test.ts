import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createLoan(personId: number) {
  const { rows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]);
  return rows[0].id;
}

describe('GET /me/loans/:id/history', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/loans/1/history' });
    expect(response.statusCode).toBe(401);
  });

  it('returns 403 for a loan belonging to a different person', async () => {
    const ownPersonId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId: ownPersonId });
    const otherPersonId = await createPerson('Maria');
    const otherLoanId = await createLoan(otherPersonId);

    const response = await app.inject({
      method: 'GET',
      url: `/me/loans/${otherLoanId}/history`,
      headers: authHeaderFor('customer', { accountId, personId: ownPersonId, username: 'juan' }),
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns the same audit entries as GET /loans/:id/history, scoped to the caller own loan', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });
    const loanId = await createLoan(personId);
    await pool.query(`UPDATE loans SET note = 'edited' WHERE id = $1`, [loanId]);

    const meResponse = await app.inject({
      method: 'GET',
      url: `/me/loans/${loanId}/history`,
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/loans/${loanId}/history`,
      headers: authHeaderFor('admin'),
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual(adminResponse.json());
    expect(meResponse.json().length).toBeGreaterThan(0);
  });
});
