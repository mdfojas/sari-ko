import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../../src/shared/db.js';
import { resetDatabase } from '../../reset-db.js';
import { hashPassword, verifyPassword } from '../../../src/shared/auth/password.js';
import { resetAdminPassword } from '../../../scripts/reset-admin-password.js';

describe('resetAdminPassword', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('updates the password_hash for an existing admin account', async () => {
    const oldHash = await hashPassword('old-password');
    const { rows } = await pool.query(
      `INSERT INTO accounts (username, password_hash, role) VALUES ('mark', $1, 'admin') RETURNING id, updated_at`,
      [oldHash],
    );

    await resetAdminPassword(pool, 'mark', 'brand-new-pass');

    const { rows: after } = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [rows[0].id]);
    expect(await verifyPassword('brand-new-pass', after[0].password_hash)).toBe(true);
    expect(await verifyPassword('old-password', after[0].password_hash)).toBe(false);
  });

  it('leaves every other column unchanged', async () => {
    const oldHash = await hashPassword('old-password');
    const { rows } = await pool.query(
      `INSERT INTO accounts (username, password_hash, role) VALUES ('mark', $1, 'admin') RETURNING id`,
      [oldHash],
    );

    await resetAdminPassword(pool, 'mark', 'brand-new-pass');

    const { rows: after } = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [rows[0].id]);
    expect(after[0].username).toBe('mark');
    expect(after[0].role).toBe('admin');
    expect(after[0].person_id).toBeNull();
  });

  it('fails clearly, with no write, for a username that does not exist', async () => {
    await expect(resetAdminPassword(pool, 'nobody', 'brand-new-pass')).rejects.toThrow();
  });

  it('fails clearly, with no write, for a username that exists but is not an admin', async () => {
    await pool.query(`INSERT INTO accounts (username, password_hash, role) VALUES ('owner1', 'hash', 'store_owner')`);

    await expect(resetAdminPassword(pool, 'owner1', 'brand-new-pass')).rejects.toThrow();

    const { rows } = await pool.query(`SELECT password_hash FROM accounts WHERE username = 'owner1'`);
    expect(rows[0].password_hash).toBe('hash');
  });

  it('makes no write when dryRun is true', async () => {
    const oldHash = await hashPassword('old-password');
    await pool.query(`INSERT INTO accounts (username, password_hash, role) VALUES ('mark', $1, 'admin')`, [oldHash]);

    await resetAdminPassword(pool, 'mark', 'brand-new-pass', { dryRun: true });

    const { rows } = await pool.query(`SELECT password_hash FROM accounts WHERE username = 'mark'`);
    expect(rows[0].password_hash).toBe(oldHash);
  });
});
