import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

async function createPerson(name: string) {
  const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ($1) RETURNING id`, [name]);
  return rows[0].id;
}

describe('POST /accounts', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'POST', url: '/accounts', payload: { role: 'admin', username: 'admin1' } });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a customer account trying to create an account', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('customer'),
      payload: { role: 'admin', username: 'admin1' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('admin can create a store_owner account with an explicit username/password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'store_owner', username: 'owner1', password: 'super-secret' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.username).toBe('owner1');
    expect(body.password).toBe('super-secret');
    expect(body.password_hash).toBeUndefined();
  });

  it('store_owner creating a customer account succeeds', async () => {
    const personId = await createPerson('Juan Dela Cruz');

    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('store_owner'),
      payload: { role: 'customer', person_id: personId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().username).toBe('juandelacruz');
  });

  it('store_owner creating an admin account fails with 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('store_owner'),
      payload: { role: 'admin', username: 'admin1' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('store_owner creating a store_owner account fails with 403', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('store_owner'),
      payload: { role: 'store_owner', username: 'owner2' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects creating a customer account without person_id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'customer' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects creating a customer account with a person_id that does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'customer', person_id: 999999 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('auto-suggests a username from the linked person, suffixing on collision', async () => {
    const firstPersonId = await createPerson('Jerico');
    const secondPersonId = await createPerson('Jerico');

    await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'customer', person_id: firstPersonId },
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'customer', person_id: secondPersonId },
    });

    expect(secondResponse.json().username).toBe('jerico2');
  });

  it('generates a random password when none is supplied, returned once in the response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'store_owner', username: 'owner3' },
    });

    expect(response.statusCode).toBe(201);
    expect(typeof response.json().password).toBe('string');
    expect(response.json().password.length).toBeGreaterThanOrEqual(8);
  });

  it('rejects an explicit username that is already taken with 409', async () => {
    await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'store_owner', username: 'owner1' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'admin', username: 'owner1' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('requires an explicit username for a non-customer account', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: authHeaderFor('admin'),
      payload: { role: 'admin' },
    });
    expect(response.statusCode).toBe(400);
  });
});
