import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /loans/:id/line-items', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists line items for a loan', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
      personRows[0].id,
    ]);
    const loanId = loanRows[0].id;
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500)`, [
      loanId,
    ]);

    const response = await app.inject({ method: 'GET', url: `/loans/${loanId}/line-items` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });
});
