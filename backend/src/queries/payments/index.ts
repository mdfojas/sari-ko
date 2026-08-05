import { pool } from '../../shared/db.js';
import { buildSetClause } from '../../shared/sql.js';

export interface CreatePaymentInput {
  amount: number;
  note?: string | null;
}

export interface UpdatePaymentInput {
  amount?: number;
  note?: string | null;
}

export async function listPaymentsByPersonId(personId: number) {
  const { rows } = await pool.query(`SELECT * FROM payments WHERE person_id = $1 ORDER BY id`, [personId]);
  return rows;
}

export async function createPayment(personId: number, input: CreatePaymentInput) {
  const { rows } = await pool.query(
    `INSERT INTO payments (person_id, amount, note) VALUES ($1, $2, $3) RETURNING *`,
    [personId, input.amount, input.note ?? null],
  );
  return rows[0];
}

export async function findPaymentById(id: number) {
  const { rows } = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updatePayment(id: number, input: UpdatePaymentInput) {
  const { setClause, values } = buildSetClause({
    amount: input.amount,
    note: input.note,
    updated_at: new Date(),
  });
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE payments SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function deletePayment(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM payments WHERE id = $1`, [id]);
  return rowCount ?? 0;
}
