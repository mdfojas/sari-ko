import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/shared/db.js';
import { resetDatabase } from '../reset-db.js';
import { createPerson } from '../helpers.js';

async function createLoan(personId: number) {
  const { rows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]);
  return rows[0].id;
}

describe('audit_log trigger', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('logs exactly one update entry containing only the changed field when a loan note is edited', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);

    await pool.query(`UPDATE loans SET note = 'Updated note' WHERE id = $1`, [loanId]);

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE entity_type = 'loan' AND entity_id = $1 AND action = 'update'`,
      [loanId],
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0].changes)).toEqual(['note']);
    expect(rows[0].changes.note).toEqual({ from: null, to: 'Updated note' });
  });

  it('logs a create entry with the full row when a payment is inserted directly via SQL, bypassing the API', async () => {
    const personId = await createPerson();

    const { rows: paymentRows } = await pool.query(
      `INSERT INTO payments (person_id, amount) VALUES ($1, 500) RETURNING id`,
      [personId],
    );
    const paymentId = paymentRows[0].id;

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE entity_type = 'payment' AND entity_id = $1 AND action = 'create'`,
      [paymentId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].changes.amount).toBe(500);
    expect(rows[0].changes.person_id).toBe(personId);
  });

  it('logs a delete entry with the full prior row when a line item is deleted', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500) RETURNING id`,
      [loanId],
    );
    const lineItemId = itemRows[0].id;

    await pool.query(`DELETE FROM loan_line_items WHERE id = $1`, [lineItemId]);

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE entity_type = 'loan_line_item' AND entity_id = $1 AND action = 'delete'`,
      [lineItemId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].changes.description).toBe('Kulang');
    expect(rows[0].changes.amount).toBe(500);
  });

  it('rejects a direct UPDATE against audit_log with a permissions error', async () => {
    // Table-level privilege checks happen before row matching in Postgres,
    // so no row needs to exist for this to be a meaningful check.
    await expect(pool.query(`UPDATE audit_log SET action = 'tampered' WHERE id = 1`)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it('rejects a direct DELETE against audit_log with a permissions error', async () => {
    await expect(pool.query(`DELETE FROM audit_log WHERE id = 1`)).rejects.toThrow(/permission denied/i);
  });
});
