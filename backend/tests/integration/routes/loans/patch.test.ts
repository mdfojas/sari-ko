import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createPersonAndLoan() {
  const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
  const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
    personRows[0].id,
  ]);
  return loanRows[0].id;
}

describe('PATCH /loans/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('edits the note', async () => {
    const loanId = await createPersonAndLoan();

    const response = await app.inject({
      method: 'PATCH',
      url: `/loans/${loanId}`,
      payload: { note: 'Paid half already' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().note).toBe('Paid half already');
  });
});
