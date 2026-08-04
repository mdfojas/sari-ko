import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createPerson() {
  const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz') RETURNING id`);
  return rows[0].id;
}

describe('POST /persons/:id/payments', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('records a payment', async () => {
    const personId = await createPerson();

    const response = await app.inject({
      method: 'POST',
      url: `/persons/${personId}/payments`,
      payload: { amount: 1000, note: 'partial payment' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().amount).toBe(1000);
  });

  it('allows recording a payment larger than the current balance', async () => {
    const personId = await createPerson();

    const response = await app.inject({
      method: 'POST',
      url: `/persons/${personId}/payments`,
      payload: { amount: 999999 },
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects a payment with amount <= 0', async () => {
    const personId = await createPerson();

    const response = await app.inject({
      method: 'POST',
      url: `/persons/${personId}/payments`,
      payload: { amount: 0 },
    });

    expect(response.statusCode).toBe(400);
  });
});
