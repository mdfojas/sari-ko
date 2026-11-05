import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../helpers.js';
import { pool } from '../../../src/shared/db.js';
import { resetDatabase } from '../../reset-db.js';

// Every stored amount fits a 32-bit INTEGER, but sums of them need not. These rows
// are inserted straight into the database, bypassing the API's write guards, to
// prove the READ side no longer depends on a sum fitting 32 bits: a SUM(...)::integer
// that overflowed used to make GET /persons return a 500 for everyone.
describe('reads stay healthy when sums exceed 32 bits', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function personWithBigLoansAndPayments() {
    const { rows: person } = await pool.query(`INSERT INTO persons (name) VALUES ('Big Sums') RETURNING id`);
    const personId = person[0].id as number;
    for (const day of ['2026-01-01', '2026-01-02']) {
      const { rows: loan } = await pool.query(`INSERT INTO loans (person_id, created_at) VALUES ($1, $2) RETURNING id`, [personId, day]);
      await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'max', 2147483647)`, [loan[0].id]);
    }
    await pool.query(`INSERT INTO payments (person_id, amount, created_at) VALUES ($1, 2147483647, '2026-01-03')`, [personId]);
    return { personId, loanTotal: 2_147_483_647, balance: 2_147_483_647 };
  }

  it('GET /persons lists everyone, with the large balance exact', async () => {
    const { balance } = await personWithBigLoansAndPayments();
    await pool.query(`INSERT INTO persons (name) VALUES ('Ordinary')`);

    const response = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    const byName = Object.fromEntries(response.json().map((p: { name: string; balance: number }) => [p.name, p.balance]));
    expect(byName['Big Sums']).toBe(balance);
    expect(byName['Ordinary']).toBe(0);
  });

  it('GET /persons/:id, the search, the balance and the ledger all agree on a balance past 2^31', async () => {
    const { personId } = await personWithBigLoansAndPayments();
    // two max loans (2 x 2,147,483,647) minus one max payment = 2,147,483,647 ... add another loan to cross 2^31 for sure
    const { rows: loan } = await pool.query(`INSERT INTO loans (person_id, created_at) VALUES ($1, '2026-01-04') RETURNING id`, [personId]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'more', 2147483647)`, [loan[0].id]);
    const expected = 2 * 2_147_483_647; // 3 loans - 1 payment

    const get = (url: string) => app.inject({ method: 'GET', url, headers: authHeaderFor('admin') });
    const one = await get(`/persons/${personId}`);
    const search = await get('/persons/search?q=big');
    const balance = await get(`/persons/${personId}/balance`);
    const ledger = await get(`/persons/${personId}/ledger`);

    expect([one.statusCode, search.statusCode, balance.statusCode, ledger.statusCode]).toEqual([200, 200, 200, 200]);
    expect(one.json().balance).toBe(expected);
    expect(search.json()[0].balance).toBe(expected);
    expect(balance.json().balance).toBe(expected);
    const entries = ledger.json();
    expect(entries[entries.length - 1].running_balance).toBe(expected);
  });

  it('GET /loans/:id returns a total past 2^31 instead of failing', async () => {
    const { rows: person } = await pool.query(`INSERT INTO persons (name) VALUES ('Loan Owner') RETURNING id`);
    const { rows: loan } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [person[0].id]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'a', 2000000000), ($1, 'b', 2000000000)`, [loan[0].id]);

    const response = await app.inject({ method: 'GET', url: `/loans/${loan[0].id}`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(4_000_000_000);
  });

  it('the ledger shows a single loan whose total is past 2^31 instead of failing', async () => {
    const { rows: person } = await pool.query(`INSERT INTO persons (name) VALUES ('Ledger Big') RETURNING id`);
    const { rows: loan } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [person[0].id]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'a', 2000000000), ($1, 'b', 2000000000)`, [loan[0].id]);

    const response = await app.inject({ method: 'GET', url: `/persons/${person[0].id}/ledger`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0]).toMatchObject({ type: 'loan', amount: 4_000_000_000 });
  });

  it('three max-size payments for one person no longer take the persons list down', async () => {
    const { rows: person } = await pool.query(`INSERT INTO persons (name) VALUES ('Overpayer') RETURNING id`);
    for (const day of ['2026-01-01', '2026-01-02', '2026-01-03']) {
      await pool.query(`INSERT INTO payments (person_id, amount, created_at) VALUES ($1, 2147483647, $2)`, [person[0].id, day]);
    }

    const response = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].balance).toBe(-3 * 2_147_483_647);
  });
});
