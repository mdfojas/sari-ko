import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('DELETE /persons/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('deletes a person with no history', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);

    const response = await app.inject({ method: 'DELETE', url: `/persons/${rows[0].id}` });

    expect(response.statusCode).toBe(204);
  });

  it('returns 409, not a raw DB error, when the person has loan history', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    await pool.query(`INSERT INTO loans (person_id) VALUES ($1)`, [rows[0].id]);

    const response = await app.inject({ method: 'DELETE', url: `/persons/${rows[0].id}` });

    expect(response.statusCode).toBe(409);
  });
});
