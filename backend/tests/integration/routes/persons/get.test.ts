import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('gets a single person', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);

    const response = await app.inject({ method: 'GET', url: `/persons/${rows[0].id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Juan Dela Cruz');
  });

  it('returns 404 for an unknown person id', async () => {
    const response = await app.inject({ method: 'GET', url: '/persons/999999' });
    expect(response.statusCode).toBe(404);
  });
});
