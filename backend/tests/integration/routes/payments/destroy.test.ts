import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /payments/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/payments/1' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/payments/1', headers: authHeaderFor('customer') });
    expect(response.statusCode).toBe(403);
  });

  it('deletes a payment', async () => {
    const { rows: personRows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    const { rows: paymentRows } = await pool.query(
      `INSERT INTO payments (person_id, amount) VALUES ($1, 500) RETURNING id`,
      [personRows[0].id],
    );

    const response = await app.inject({
      method: 'DELETE',
      url: `/payments/${paymentRows[0].id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(204);
  });
});
