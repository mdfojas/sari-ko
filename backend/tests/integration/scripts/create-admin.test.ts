import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../../src/shared/db.js';
import { resetDatabase } from '../../reset-db.js';
import { verifyPassword } from '../../../src/shared/auth/password.js';
import { createFirstAdmin } from '../../../scripts/create-admin.js';

describe('createFirstAdmin', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('inserts exactly one admin account with a bcrypt-hashed password', async () => {
    await createFirstAdmin(pool, 'mark', 'correct-horse');

    const { rows } = await pool.query(`SELECT * FROM accounts`);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('mark');
    expect(rows[0].role).toBe('admin');
    expect(rows[0].person_id).toBeNull();
    expect(rows[0].password_hash).not.toBe('correct-horse');
    expect(await verifyPassword('correct-horse', rows[0].password_hash)).toBe(true);
  });

  it('refuses to run, with no write, when the accounts table already has a row', async () => {
    await pool.query(`INSERT INTO accounts (username, password_hash, role) VALUES ('owner1', 'hash', 'store_owner')`);

    await expect(createFirstAdmin(pool, 'mark', 'correct-horse')).rejects.toThrow();

    const { rows } = await pool.query(`SELECT * FROM accounts`);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe('owner1');
  });

  it('makes no write when dryRun is true', async () => {
    await createFirstAdmin(pool, 'mark', 'correct-horse', { dryRun: true });

    const { rows } = await pool.query(`SELECT * FROM accounts`);
    expect(rows).toHaveLength(0);
  });
});
