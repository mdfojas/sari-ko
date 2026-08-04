import type { Pool, PoolClient } from 'pg';
import { pool } from '../../shared/db.js';
import { buildSetClause } from '../../shared/sql.js';

export interface CreateLineItemInput {
  product_id?: number;
  quantity?: number;
  description?: string;
  amount?: number;
}

export class ProductNotFoundError extends Error {}

// Shared by loan creation (multiple items in one transaction, via a
// PoolClient) and adding a single item to an existing loan (via the plain
// Pool) — product-linked items snapshot the product's *current* name/price
// at insert time; freeform items use the submitted description/amount as-is.
export async function insertLineItem(client: Pool | PoolClient, loanId: number, input: CreateLineItemInput) {
  if (input.product_id !== undefined) {
    const { rows: productRows } = await client.query(`SELECT name, sale_price FROM products WHERE id = $1`, [
      input.product_id,
    ]);
    if (productRows.length === 0) {
      throw new ProductNotFoundError(`Product ${input.product_id} not found`);
    }
    const product = productRows[0];
    const quantity = input.quantity as number;
    const unitPrice = product.sale_price;
    const amount = quantity * unitPrice;

    const { rows } = await client.query(
      `INSERT INTO loan_line_items (loan_id, product_id, description, quantity, unit_price, amount)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [loanId, input.product_id, product.name, quantity, unitPrice, amount],
    );
    return rows[0];
  }

  const { rows } = await client.query(
    `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, $2, $3) RETURNING *`,
    [loanId, input.description, input.amount],
  );
  return rows[0];
}

export async function listLineItemsByLoanId(loanId: number) {
  const { rows } = await pool.query(`SELECT * FROM loan_line_items WHERE loan_id = $1 ORDER BY id`, [loanId]);
  return rows;
}

export async function findLineItemById(id: number) {
  const { rows } = await pool.query(`SELECT * FROM loan_line_items WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function isLastRemainingLineItem(id: number): Promise<boolean> {
  const item = await findLineItemById(id);
  if (!item) return false;

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM loan_line_items WHERE loan_id = $1`, [
    item.loan_id,
  ]);
  return rows[0].count === 1;
}

export async function deleteLineItem(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM loan_line_items WHERE id = $1`, [id]);
  return rowCount ?? 0;
}

export interface UpdateLineItemInput {
  description?: string;
  quantity?: number;
  amount?: number;
}

// If this is a product-linked item and quantity is being edited, amount is
// recomputed from the *existing* unit_price snapshot — the product's current
// sale_price is never re-fetched, so an edit never silently repricing a loan.
export async function updateLineItem(id: number, input: UpdateLineItemInput) {
  const existing = await findLineItemById(id);
  if (!existing) return null;

  const amount =
    input.quantity !== undefined && existing.product_id !== null
      ? input.quantity * existing.unit_price
      : input.amount;

  const { setClause, values } = buildSetClause({
    description: input.description,
    quantity: input.quantity,
    amount,
    updated_at: new Date(),
  });
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE loan_line_items SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}
