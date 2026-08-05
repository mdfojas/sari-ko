import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createLoan() {
  const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
  const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
    personRows[0].id,
  ]);
  return loanRows[0].id;
}

async function addLineItem(loanId: number, amount: number) {
  const { rows } = await pool.query(
    `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Item', $2) RETURNING id`,
    [loanId, amount],
  );
  return rows[0].id;
}

describe('DELETE /line-items/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('deletes one of several line items normally', async () => {
    const loanId = await createLoan();
    const itemId = await addLineItem(loanId, 500);
    await addLineItem(loanId, 300);

    const response = await app.inject({ method: 'DELETE', url: `/line-items/${itemId}` });

    expect(response.statusCode).toBe(204);
  });

  it('rejects deleting the only remaining line item on a loan', async () => {
    const loanId = await createLoan();
    const itemId = await addLineItem(loanId, 500);

    const response = await app.inject({ method: 'DELETE', url: `/line-items/${itemId}` });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/DELETE \/loans/i);
  });
});
