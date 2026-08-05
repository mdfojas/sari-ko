import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('lists all persons', async () => {
    await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz')`);

    const response = await app.inject({ method: 'GET', url: '/persons' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
  });
});
