import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /loans/:id/history', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('reflects edits to both the loan and its line items, in chronological order', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
      personRows[0].id,
    ]);
    const loanId = loanRows[0].id;
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500) RETURNING id`,
      [loanId],
    );
    const lineItemId = itemRows[0].id;

    await pool.query(`UPDATE loans SET note = 'Edited note' WHERE id = $1`, [loanId]);
    await pool.query(`UPDATE loan_line_items SET amount = 1000 WHERE id = $1`, [lineItemId]);

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/loans/${loanId}/history` });

    expect(response.statusCode).toBe(200);
    const entries = response.json();
    const actions = entries.map((e: { entity_type: string; action: string }) => `${e.entity_type}:${e.action}`);
    expect(actions).toEqual([
      'loan:create',
      'loan_line_item:create',
      'loan:update',
      'loan_line_item:update',
    ]);
    const lineItemUpdate = entries.find((e: { entity_type: string; action: string }) => e.entity_type === 'loan_line_item' && e.action === 'update');
    expect(lineItemUpdate.changes.amount).toEqual({ from: 500, to: 1000 });
  });

  it('includes history for a line item even after it is deleted', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: loanRows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [
      personRows[0].id,
    ]);
    const loanId = loanRows[0].id;
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500) RETURNING id`,
      [loanId],
    );
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Other', 300)`, [
      loanId,
    ]);
    await pool.query(`DELETE FROM loan_line_items WHERE id = $1`, [itemRows[0].id]);

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: `/loans/${loanId}/history` });

    const entries = response.json();
    const deleteEntry = entries.find(
      (e: { entity_type: string; action: string }) => e.entity_type === 'loan_line_item' && e.action === 'delete',
    );
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry.changes.description).toBe('Kulang');
  });
});
