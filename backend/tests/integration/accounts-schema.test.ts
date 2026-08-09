import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/shared/db.js';
import { resetDatabase } from '../reset-db.js';
import { createAccount, createPerson } from '../helpers.js';

describe('accounts schema', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a customer account with no person_id', async () => {
    await expect(createAccount({ username: 'juan', role: 'customer', personId: null })).rejects.toThrow();
  });

  it('rejects an admin account with a person_id set', async () => {
    const personId = await createPerson();
    await expect(createAccount({ username: 'admin1', role: 'admin', personId })).rejects.toThrow();
  });

  it('accepts a store_owner account with no person_id', async () => {
    const id = await createAccount({ username: 'owner1', role: 'store_owner', personId: null });
    expect(typeof id).toBe('number');
  });

  it('rejects two accounts with the same username', async () => {
    await createAccount({ username: 'owner1', role: 'store_owner' });

    await expect(createAccount({ username: 'owner1', role: 'admin' })).rejects.toThrow();
  });

  it('rejects two customer accounts linked to the same person', async () => {
    const personId = await createPerson();
    await createAccount({ username: 'juan', role: 'customer', personId });

    await expect(createAccount({ username: 'juan2', role: 'customer', personId })).rejects.toThrow();
  });

  it('restricts deleting a person with a linked account', async () => {
    const personId = await createPerson();
    await createAccount({ username: 'juan', role: 'customer', personId });

    await expect(pool.query(`DELETE FROM persons WHERE id = $1`, [personId])).rejects.toThrow();
  });

  it('allows deleting a person with no linked account', async () => {
    const personId = await createPerson();

    await expect(pool.query(`DELETE FROM persons WHERE id = $1`, [personId])).resolves.toBeDefined();
  });
});
