import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createPerson } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('POST /persons/:id/payments', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('records a payment', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/payments`,
      payload: { amount: 1000, note: 'partial payment' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().amount).toBe(1000);
  });

  it('allows recording a payment larger than the current balance', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/payments`,
      payload: { amount: 999999 },
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects a payment with amount <= 0', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/${personId}/payments`,
      payload: { amount: 0 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404, not 500, for a nonexistent person id', async () => {
    const response = await app.inject({
      headers: authHeaderFor('admin'),
      method: 'POST',
      url: `/persons/999999/payments`,
      payload: { amount: 500 },
    });

    expect(response.statusCode).toBe(404);
  });
});
