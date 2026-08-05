import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons/:id/balance', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("matches the ledger's final running balance", async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const personId = personRows[0].id;
    const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Item', 1000)`, [
      loanRows[0].id,
    ]);
    await pool.query(`INSERT INTO payments (person_id, amount) VALUES ($1, 400)`, [personId]);

    const ledgerResponse = await app.inject({ method: 'GET', url: `/persons/${personId}/ledger` });
    const ledger = ledgerResponse.json();
    const expectedBalance = ledger[ledger.length - 1].running_balance;

    const balanceResponse = await app.inject({ method: 'GET', url: `/persons/${personId}/balance` });

    expect(balanceResponse.statusCode).toBe(200);
    expect(balanceResponse.json().balance).toBe(expectedBalance);
    expect(balanceResponse.json().balance).toBe(600);
  });

  it('returns 0 for a person with no history', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('New Person') RETURNING id`);

    const response = await app.inject({ method: 'GET', url: `/persons/${rows[0].id}/balance` });

    expect(response.json().balance).toBe(0);
  });
});
