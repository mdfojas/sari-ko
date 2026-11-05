import type { Pool, PoolClient } from 'pg';
import { pool } from '../../shared/db.js';
import { withTransaction } from '../../shared/transaction.js';
import { buildSetClause } from '../../shared/sql.js';
import { INT_MAX, MAX_AMOUNT_TEXT } from '../../shared/validation.js';

export interface CreateLineItemInput {
  product_id?: number;
  quantity?: number;
  description?: string;
  amount?: number;
}

export class ProductNotFoundError extends Error {}

// Thrown when a write would put a line item, or a whole loan, past what the
// 32-bit INTEGER money columns can hold. Raised inside the writing transaction
// so everything rolls back — otherwise the oversized row would be saved and
// then break every SUM(...)::integer that reads it back (the loan response, a
// person's balance, the ledger).
export class AmountTooLargeError extends Error {}

// Serialises writers on one loan. Without it, two concurrent adds each read the
// total before the other commits (READ COMMITTED), both see room, and together
// exceed the ceiling. Returns false if the loan does not exist.
export async function lockLoan(client: Pool | PoolClient, loanId: number): Promise<boolean> {
  const { rowCount } = await client.query(`SELECT id FROM loans WHERE id = $1 FOR UPDATE`, [loanId]);
  return (rowCount ?? 0) > 0;
}

export async function assertLoanTotalWithinLimit(client: Pool | PoolClient, loanId: number): Promise<void> {
  const { rows } = await client.query(`SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM loan_line_items WHERE loan_id = $1`, [
    loanId,
  ]);
  if (Number(rows[0].total) > INT_MAX) {
    throw new AmountTooLargeError(`The loan total can be at most ${MAX_AMOUNT_TEXT}`);
  }
}

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
    if (amount > INT_MAX) {
      throw new AmountTooLargeError(`A line item can be at most ${MAX_AMOUNT_TEXT}`);
    }

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

export type RemoveLineItemResult = 'deleted' | 'not_found' | 'last_item';

// The "never leave a loan empty" rule is a read-then-delete, so it runs under
// the loan's row lock: two simultaneous deletes of a loan's last two items
// would otherwise each see two items and both delete, leaving none.
export async function removeLineItem(id: number): Promise<RemoveLineItemResult> {
  return withTransaction(pool, async (client) => {
    const { rows: found } = await client.query(`SELECT loan_id FROM loan_line_items WHERE id = $1`, [id]);
    if (found.length === 0) return 'not_found';
    const loanId = found[0].loan_id;

    await lockLoan(client, loanId);
    const { rows: count } = await client.query(`SELECT COUNT(*)::int AS count FROM loan_line_items WHERE loan_id = $1`, [loanId]);
    const { rowCount } = await client.query(`SELECT 1 FROM loan_line_items WHERE id = $1`, [id]);
    if ((rowCount ?? 0) === 0) return 'not_found';
    if (count[0].count === 1) return 'last_item';

    await client.query(`DELETE FROM loan_line_items WHERE id = $1`, [id]);
    return 'deleted';
  });
}

export interface UpdateLineItemInput {
  description?: string;
  quantity?: number;
  amount?: number;
}

export class InvalidLineItemUpdateError extends Error {}

// If this is a product-linked item and quantity is being edited, amount is
// recomputed from the *existing* unit_price snapshot — the product's current
// sale_price is never re-fetched, so an edit never silently repricing a loan.
export async function updateLineItem(id: number, input: UpdateLineItemInput) {
  return withTransaction(pool, async (client) => {
    const { rows: found } = await client.query(`SELECT * FROM loan_line_items WHERE id = $1`, [id]);
    const existing = found[0];
    if (!existing) return null;

    // Lock the loan, then re-read the item: it may have changed while waiting.
    await lockLoan(client, existing.loan_id);
    const { rows: current } = await client.query(`SELECT * FROM loan_line_items WHERE id = $1`, [id]);
    const item = current[0];
    if (!item) return null;

    const isProductLinked = item.product_id !== null;
    if (isProductLinked && input.amount !== undefined) {
      throw new InvalidLineItemUpdateError(
        'amount cannot be set directly on a product-linked line item — edit quantity instead',
      );
    }
    if (!isProductLinked && input.quantity !== undefined) {
      throw new InvalidLineItemUpdateError('quantity cannot be set on a freeform line item');
    }

    const amount = isProductLinked && input.quantity !== undefined ? input.quantity * item.unit_price : input.amount;
    if (amount !== undefined && amount > INT_MAX) {
      throw new AmountTooLargeError(`A line item can be at most ${MAX_AMOUNT_TEXT}`);
    }

    const { setClause, values } = buildSetClause({
      description: input.description,
      quantity: input.quantity,
      amount,
      updated_at: new Date(),
    });
    values.push(id);

    const { rows } = await client.query(
      `UPDATE loan_line_items SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    await assertLoanTotalWithinLimit(client, item.loan_id);
    return rows[0] ?? null;
  });
}
