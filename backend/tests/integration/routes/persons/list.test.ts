import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/persons' });
    expect(response.statusCode).toBe(401);
  });

  it('lists all persons', async () => {
    await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz')`);

    const response = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].has_account).toBe(false);
  });
});
