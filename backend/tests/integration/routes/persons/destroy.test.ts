import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount } from '../../../helpers.js';
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

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'DELETE', url: `/persons/${rows[0].id}` });

    expect(response.statusCode).toBe(204);
  });

  it('returns 409, not a raw DB error, when the person has loan history', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    await pool.query(`INSERT INTO loans (person_id) VALUES ($1)`, [rows[0].id]);

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'DELETE', url: `/persons/${rows[0].id}` });

    expect(response.statusCode).toBe(409);
  });

  it('returns 409, mentioning the account, when the person has a linked account', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    await createAccount({ username: 'juan', role: 'customer', personId: rows[0].id });

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'DELETE',
      url: `/persons/${rows[0].id}`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/account/i);
  });
});
