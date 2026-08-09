import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('PATCH /persons/:id', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('edits name and contact', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: `/persons/${rows[0].id}`,
      payload: { contact: '09171234567' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().contact).toBe('09171234567');
  });

  it('returns 404 for an unknown person id', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'PATCH',
      url: '/persons/999999',
      payload: { name: 'X' },
    });
    expect(response.statusCode).toBe(404);
  });
});
