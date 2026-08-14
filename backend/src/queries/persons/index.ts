import { pool } from '../../shared/db.js';
import { buildSetClause } from '../../shared/sql.js';

export interface CreatePersonInput {
  name: string;
  contact?: string | null;
}

const HAS_ACCOUNT_SELECT = `
  SELECT p.*, EXISTS (SELECT 1 FROM accounts a WHERE a.person_id = p.id) AS has_account
  FROM persons p
`;

export async function listPersons() {
  const { rows } = await pool.query(`${HAS_ACCOUNT_SELECT} ORDER BY p.id`);
  return rows;
}

export async function searchPersons(q: string) {
  const { rows } = await pool.query(
    `${HAS_ACCOUNT_SELECT} WHERE p.name ILIKE '%' || $1 || '%' ORDER BY p.id`,
    [q],
  );
  return rows;
}

export async function findPersonById(id: number) {
  const { rows } = await pool.query(`${HAS_ACCOUNT_SELECT} WHERE p.id = $1`, [id]);
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

export async function deletePerson(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM persons WHERE id = $1`, [id]);
  return rowCount ?? 0;
}

export interface LedgerEntry {
  date: Date;
  type: 'loan' | 'payment';
  description: string;
  amount: number;
  running_balance: number;
}

// Loans and payments are two independent streams (see the feature spec's
// "Balance model" — payments are never tied to a specific loan). The ledger
// just interleaves both chronologically and walks a running total.
export async function getLedgerForPerson(personId: number): Promise<LedgerEntry[]> {
  const { rows: loanRows } = await pool.query(
    `SELECT l.id, l.created_at,
       COALESCE(STRING_AGG(lli.description, ', '), '') AS description,
       COALESCE(SUM(lli.amount), 0)::integer AS amount
     FROM loans l
     LEFT JOIN loan_line_items lli ON lli.loan_id = l.id
     WHERE l.person_id = $1
     GROUP BY l.id, l.created_at`,
    [personId],
  );
  const { rows: paymentRows } = await pool.query(
    `SELECT id, created_at, COALESCE(note, '') AS description, amount FROM payments WHERE person_id = $1`,
    [personId],
  );

  const entries: Omit<LedgerEntry, 'running_balance'>[] = [
    ...loanRows.map((row) => ({
      date: row.created_at,
      type: 'loan' as const,
      description: row.description,
      amount: row.amount,
    })),
    ...paymentRows.map((row) => ({
      date: row.created_at,
      type: 'payment' as const,
      description: row.description,
      amount: -row.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;
  return entries.map((entry) => {
    runningBalance += entry.amount;
    return { ...entry, running_balance: runningBalance };
  });
}

export async function getBalanceForPerson(personId: number): Promise<number> {
  const ledger = await getLedgerForPerson(personId);
  return ledger.length === 0 ? 0 : ledger[ledger.length - 1].running_balance;
}
