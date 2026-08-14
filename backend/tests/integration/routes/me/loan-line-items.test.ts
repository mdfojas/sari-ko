import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createLoanWithLineItem(personId: number) {
  const { rows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]);
  const loanId = rows[0].id;
  await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Rice', 500)`, [loanId]);
  return loanId;
}

describe('GET /me/loans/:id/line-items', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/me/loans/1/line-items' });
    expect(response.statusCode).toBe(401);
  });

  it('returns 403 for a loan belonging to a different person', async () => {
    const ownPersonId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId: ownPersonId });
    const otherPersonId = await createPerson('Maria');
    const otherLoanId = await createLoanWithLineItem(otherPersonId);

    const response = await app.inject({
      method: 'GET',
      url: `/me/loans/${otherLoanId}/line-items`,
      headers: authHeaderFor('customer', { accountId, personId: ownPersonId, username: 'juan' }),
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns the same data as GET /loans/:id/line-items for the caller own loan', async () => {
    const personId = await createPerson('Juan');
    const accountId = await createAccount({ username: 'juan', role: 'customer', personId });
    const loanId = await createLoanWithLineItem(personId);

    const meResponse = await app.inject({
      method: 'GET',
      url: `/me/loans/${loanId}/line-items`,
      headers: authHeaderFor('customer', { accountId, personId, username: 'juan' }),
    });
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/loans/${loanId}/line-items`,
      headers: authHeaderFor('admin'),
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual(adminResponse.json());
    expect(meResponse.json()).toHaveLength(1);
  });
});
