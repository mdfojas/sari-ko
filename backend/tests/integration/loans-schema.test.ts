import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/shared/db.js';
import { resetDatabase } from '../reset-db.js';

async function createPerson() {
  const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Test Person') RETURNING id`);
  return rows[0].id;
}

async function createLoan(personId: number) {
  const { rows } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [personId]);
  return rows[0].id;
}

async function createProduct() {
  const { rows } = await pool.query(
    `INSERT INTO products (name) VALUES ('Test Product') RETURNING id`,
  );
  return rows[0].id;
}

describe('loans schema', () => {
  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a product-linked line item with quantity null', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);
    const productId = await createProduct();

    await expect(
      pool.query(
        `INSERT INTO loan_line_items (loan_id, product_id, description, unit_price, amount)
         VALUES ($1, $2, 'Test', 500, 500)`,
        [loanId, productId],
      ),
    ).rejects.toThrow();
  });

  it('rejects a product-linked line item whose amount disagrees with quantity * unit_price', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);
    const productId = await createProduct();

    await expect(
      pool.query(
        `INSERT INTO loan_line_items (loan_id, product_id, description, quantity, unit_price, amount)
         VALUES ($1, $2, 'Test', 2, 500, 999)`,
        [loanId, productId],
      ),
    ).rejects.toThrow();
  });

  it('accepts a freeform line item with no product link', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);

    const { rows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500) RETURNING id`,
      [loanId],
    );
    expect(rows).toHaveLength(1);
  });

  it('restricts deleting a person with loan history', async () => {
    const personId = await createPerson();
    await createLoan(personId);

    await expect(pool.query(`DELETE FROM persons WHERE id = $1`, [personId])).rejects.toThrow();
  });

  it('restricts deleting a person with payment history', async () => {
    const personId = await createPerson();
    await pool.query(`INSERT INTO payments (person_id, amount) VALUES ($1, 100)`, [personId]);

    await expect(pool.query(`DELETE FROM persons WHERE id = $1`, [personId])).rejects.toThrow();
  });

  it('cascades loan deletion to its line items', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'Kulang', 500)`, [
      loanId,
    ]);

    await pool.query(`DELETE FROM loans WHERE id = $1`, [loanId]);

    const { rows } = await pool.query(`SELECT * FROM loan_line_items WHERE loan_id = $1`, [loanId]);
    expect(rows).toHaveLength(0);
  });

  it('sets product_id to null (without deleting the line item) when the referenced product is deleted', async () => {
    const personId = await createPerson();
    const loanId = await createLoan(personId);
    const productId = await createProduct();
    const { rows: itemRows } = await pool.query(
      `INSERT INTO loan_line_items (loan_id, product_id, description, quantity, unit_price, amount)
       VALUES ($1, $2, 'Test Product', 2, 500, 1000) RETURNING id`,
      [loanId, productId],
    );
    const lineItemId = itemRows[0].id;

    await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);

    const { rows } = await pool.query(`SELECT * FROM loan_line_items WHERE id = $1`, [lineItemId]);
    expect(rows[0].product_id).toBeNull();
    expect(rows[0].amount).toBe(1000);
  });
});
