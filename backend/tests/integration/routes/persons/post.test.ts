import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /persons', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a person with name and optional contact', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: '/persons',
      payload: { name: 'Juan Dela Cruz', contact: '09171234567' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.name).toBe('Juan Dela Cruz');
    expect(body.contact).toBe('09171234567');
  });

  it('rejects creating a person without a name', async () => {
    const response = await app.inject({ headers: authHeaderFor('admin'), method: 'POST', url: '/persons', payload: {} });
    expect(response.statusCode).toBe(400);
  });
});
