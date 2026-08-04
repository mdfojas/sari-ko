import { pool } from '../../shared/db.js';
import { buildSetClause } from '../../shared/sql.js';

export interface CreatePersonInput {
  name: string;
  contact?: string | null;
}

export async function listPersons() {
  const { rows } = await pool.query(`SELECT * FROM persons ORDER BY id`);
  return rows;
}

export async function searchPersons(q: string) {
  const { rows } = await pool.query(`SELECT * FROM persons WHERE name ILIKE '%' || $1 || '%' ORDER BY id`, [q]);
  return rows;
}

export async function findPersonById(id: number) {
  const { rows } = await pool.query(`SELECT * FROM persons WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createPerson(input: CreatePersonInput) {
  const { rows } = await pool.query(
    `INSERT INTO persons (name, contact) VALUES ($1, $2) RETURNING *`,
    [input.name, input.contact ?? null],
  );
  return rows[0];
}

export interface UpdatePersonInput {
  name?: string;
  contact?: string | null;
}

export async function updatePerson(id: number, input: UpdatePersonInput) {
  const { setClause, values } = buildSetClause({
    name: input.name,
    contact: input.contact,
    updated_at: new Date(),
  });
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE persons SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

const FOREIGN_KEY_VIOLATION = '23503';

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === FOREIGN_KEY_VIOLATION;
}

export async function deletePerson(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM persons WHERE id = $1`, [id]);
  return rowCount ?? 0;
}
