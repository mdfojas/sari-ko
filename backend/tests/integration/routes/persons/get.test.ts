import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createAccount } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/persons/1' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const response = await app.inject({ method: 'GET', url: '/persons/1', headers: authHeaderFor('customer') });
    expect(response.statusCode).toBe(403);
  });

  it('gets a single person', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);

    const response = await app.inject({
      method: 'GET',
      url: `/persons/${rows[0].id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Juan Dela Cruz');
  });

  it('returns 404 for an unknown person id', async () => {
    const response = await app.inject({ method: 'GET', url: '/persons/999999', headers: authHeaderFor('admin') });
    expect(response.statusCode).toBe(404);
  });

  it('returns has_account: false for a person with no linked account', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);

    const response = await app.inject({
      method: 'GET',
      url: `/persons/${rows[0].id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.json().has_account).toBe(false);
  });

  it('returns has_account: true for a person with a linked account', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
    await createAccount({ username: 'juan', role: 'customer', personId: rows[0].id });

    const response = await app.inject({
      method: 'GET',
      url: `/persons/${rows[0].id}`,
      headers: authHeaderFor('admin'),
    });

    expect(response.json().has_account).toBe(true);
  });
});
