import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons/:id/ledger', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('matches the worked example: loan, loan, partial payment, loan, payment', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const personId = personRows[0].id;

    const { rows: loan1 } = await pool.query(
      `INSERT INTO loans (person_id, created_at) VALUES ($1, '2026-01-01') RETURNING id`,
      [personId],
    );
    await pool.query(
      `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, '2 canned goods', 500)`,
      [loan1[0].id],
    );

    const { rows: loan2 } = await pool.query(
      `INSERT INTO loans (person_id, created_at) VALUES ($1, '2026-01-03') RETURNING id`,
      [personId],
    );
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, '1kg rice', 1225)`, [
      loan2[0].id,
    ]);

    await pool.query(
      `INSERT INTO payments (person_id, amount, note, created_at) VALUES ($1, 1000, 'partial payment', '2026-01-05')`,
      [personId],
    );

    const { rows: loan3 } = await pool.query(
      `INSERT INTO loans (person_id, created_at) VALUES ($1, '2026-01-06') RETURNING id`,
      [personId],
    );
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'soap', 300)`, [
      loan3[0].id,
    ]);

    await pool.query(
      `INSERT INTO payments (person_id, amount, note, created_at) VALUES ($1, 1025, 'payment', '2026-01-08')`,
      [personId],
    );

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/persons/${personId}/ledger` });

    expect(response.statusCode).toBe(200);
    const balances = response.json().map((entry: { running_balance: number }) => entry.running_balance);
    expect(balances).toEqual([500, 1725, 725, 1025, 0]);
  });
});
