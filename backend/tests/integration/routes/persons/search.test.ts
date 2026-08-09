import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons/search', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('finds a person by a substring of their name', async () => {
    await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz')`);
    await pool.query(`INSERT INTO persons (name) VALUES ('Maria Santos')`);

    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'GET', url: '/persons/search?q=dela' });

    expect(response.statusCode).toBe(200);
    const results = response.json();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Juan Dela Cruz');
  });
});
