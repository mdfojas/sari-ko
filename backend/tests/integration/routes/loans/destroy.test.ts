import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /loans/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/loans/1' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/loans/1', headers: authHeaderFor('customer') });
    expect(response.statusCode).toBe(403);
  });

  it('deletes a loan and cascades its line items', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
      personRows[0].id,
    ]);
    const loanId = loanRows[0].id;
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500)`, [
      loanId,
    ]);

    const response = await app.inject({ method: 'DELETE', url: `/loans/${loanId}`, headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(204);
    const { rows } = await pool.query(`SELECT * FROM loan_line_items WHERE loan_id = $1`, [loanId]);
    expect(rows).toHaveLength(0);
  });
});
