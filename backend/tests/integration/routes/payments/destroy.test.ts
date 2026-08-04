import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /payments/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('deletes a payment', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: paymentRows } = await pool.query(
      `INSERT INTO payments (person_id, amount) VALUES ($1, 500) RETURNING id`,
      [personRows[0].id],
    );

    const response = await app.inject({ method: 'DELETE', url: `/payments/${paymentRows[0].id}` });

    expect(response.statusCode).toBe(204);
  });
});
