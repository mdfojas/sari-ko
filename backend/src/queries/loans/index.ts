import type { PoolClient } from 'pg';
import { pool } from '../../shared/db.js';
import { buildSetClause } from '../../shared/sql.js';
import { withTransaction } from '../../shared/transaction.js';
import { insertLineItem, type CreateLineItemInput } from '../line-items/index.js';

export interface CreateLoanInput {
  note?: string | null;
  line_items: CreateLineItemInput[];
}

export interface UpdateLoanInput {
  note?: string | null;
}

const LOAN_SELECT = `
  SELECT l.id, l.person_id, l.note, l.created_at, l.updated_at,
    COALESCE((SELECT SUM(amount) FROM loan_line_items WHERE loan_id = l.id), 0)::integer AS total
  FROM loans l
`;

export async function findLoanById(id: number) {
  const { rows } = await pool.query(`${LOAN_SELECT} WHERE l.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createLoanForPerson(personId: number, input: CreateLoanInput): Promise<number> {
  return withTransaction(pool, async (client: PoolClient) => {
    const { rows } = await client.query(`INSERT INTO loans (person_id, note) VALUES ($1, $2) RETURNING id`, [
      personId,
      input.note ?? null,
    ]);
    const loanId = rows[0].id;

    for (const lineItem of input.line_items) {
      await insertLineItem(client, loanId, lineItem);
    }

    return loanId;
  });
}

export async function updateLoan(id: number, input: UpdateLoanInput): Promise<number> {
  const { setClause, values } = buildSetClause({ note: input.note, updated_at: new Date() });
  values.push(id);

  const { rowCount } = await pool.query(`UPDATE loans SET ${setClause} WHERE id = $${values.length}`, values);
  return rowCount ?? 0;
}

export async function deleteLoan(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM loans WHERE id = $1`, [id]);
  return rowCount ?? 0;
}
