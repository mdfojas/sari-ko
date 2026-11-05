import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
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
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/loans/${loanId}`,
      payload: { note: 'Paid half already' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().note).toBe('Paid half already');
  });

  describe('input the database cannot take', () => {
    const patch = (id: number, payload?: unknown) =>
      app.inject({
        headers: authHeaderFor('admin'),
        method: 'PATCH',
        url: `/loans/${id}`,
        ...(payload === undefined ? {} : { payload: payload as object }),
      });

    it('returns 400 for no body at all', async () => {
      const loanId = await createPersonAndLoan();
      expect((await patch(loanId)).statusCode).toBe(400);
    });

    it.each([
      ['a numeric note', { note: 123 }],
      ['an object note', { note: {} }],
      ['a NUL byte in the note', { note: 'a\u0000b' }],
    ])('returns 400, not a coerced save or a database 500, for %s', async (_label, payload) => {
      const loanId = await createPersonAndLoan();
      const response = await patch(loanId, payload);
      expect(response.statusCode).toBe(400);
      const { rows } = await pool.query(`SELECT note FROM loans WHERE id = $1`, [loanId]);
      expect(rows[0].note).toBeNull();
    });

    it('still lets a note be cleared with null', async () => {
      const loanId = await createPersonAndLoan();
      await patch(loanId, { note: 'temp' });
      const response = await patch(loanId, { note: null });
      expect(response.statusCode).toBe(200);
      expect(response.json().note).toBeNull();
    });
  });
});
