import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons/:id/payments', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists payments for a person', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    await pool.query(`INSERT INTO payments (person_id, amount) VALUES ($1, 500)`, [rows[0].id]);

    const response = await app.inject({ method: 'GET', url: `/persons/${rows[0].id}/payments` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });
});
