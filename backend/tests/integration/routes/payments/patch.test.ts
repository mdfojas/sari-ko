import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createPayment() {
  const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
  const { rows: paymentRows } = await pool.query(
    `INSERT INTO payments (person_id, amount) VALUES ($1, 500) RETURNING id`,
    [personRows[0].id],
  );
  return paymentRows[0].id;
}

describe('PATCH /payments/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('edits amount and note', async () => {
    const paymentId = await createPayment();

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/payments/${paymentId}`,
      payload: { amount: 750, note: 'corrected' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().amount).toBe(750);
  });

  it('rejects updating amount to <= 0', async () => {
    const paymentId = await createPayment();

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/payments/${paymentId}`,
      payload: { amount: 0 },
    });

    expect(response.statusCode).toBe(400);
  });
});
