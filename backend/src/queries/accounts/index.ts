import { pool } from '../../shared/db.js';
import type { Role } from '../../shared/auth/jwt.js';

export interface Account {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  person_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAccountInput {
  username: string;
  passwordHash: string;
  role: Role;
  personId?: number | null;
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const { rows } = await pool.query(
    `INSERT INTO accounts (username, password_hash, role, person_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.username, input.passwordHash, input.role, input.personId ?? null],
  );
  return rows[0];
}

export async function findAccountById(id: number): Promise<Account | null> {
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findAccountByUsername(username: string): Promise<Account | null> {
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE username = $1`, [username]);
  return rows[0] ?? null;
}

export async function listAccounts(roles?: Role[]): Promise<Account[]> {
  if (roles) {
    const { rows } = await pool.query(`SELECT * FROM accounts WHERE role = ANY($1) ORDER BY id`, [roles]);
    return rows;
  }
  const { rows } = await pool.query(`SELECT * FROM accounts ORDER BY id`);
  return rows;
}

export async function listUsernames(): Promise<string[]> {
  const { rows } = await pool.query(`SELECT username FROM accounts`);
  return rows.map((row) => row.username);
}

export async function personHasAccount(personId: number): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM accounts WHERE person_id = $1`, [personId]);
  return rows.length > 0;
}

export async function deleteAccount(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM accounts WHERE id = $1`, [id]);
  return rowCount ?? 0;
}

export async function updatePasswordHash(id: number, passwordHash: string): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE accounts SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, id],
  );
  return rowCount ?? 0;
}

export async function updateUsername(id: number, username: string): Promise<number> {
  const { rowCount } = await pool.query(`UPDATE accounts SET username = $1, updated_at = now() WHERE id = $2`, [
    username,
    id,
  ]);
  return rowCount ?? 0;
}
