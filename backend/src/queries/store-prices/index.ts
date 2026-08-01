import { pool } from '../../shared/db.js';

const STORE_PRICE_COLUMNS = 'id, product_id, store_name, price, created_at, updated_at';

export interface UpdateStorePriceInput {
  store_name?: string;
  price?: number;
}

export async function listStorePricesByProductId(productId: number) {
  const { rows } = await pool.query(
    `SELECT ${STORE_PRICE_COLUMNS} FROM store_prices WHERE product_id = $1 ORDER BY id`,
    [productId],
  );
  return rows;
}

export async function createStorePrice(productId: number, storeName: string, price: number) {
  const { rows } = await pool.query(
    `INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, $2, $3)
     RETURNING ${STORE_PRICE_COLUMNS}`,
    [productId, storeName, price],
  );
  return rows[0];
}

export async function findStorePriceById(id: number) {
  const { rows } = await pool.query(`SELECT ${STORE_PRICE_COLUMNS} FROM store_prices WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateStorePrice(id: number, input: UpdateStorePriceInput) {
  const columns: string[] = [];
  const values: unknown[] = [];
  const setField = (column: string, value: unknown) => {
    values.push(value);
    columns.push(`${column} = $${values.length}`);
  };

  if (input.store_name !== undefined) setField('store_name', input.store_name);
  if (input.price !== undefined) setField('price', input.price);
  setField('updated_at', new Date());
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE store_prices SET ${columns.join(', ')} WHERE id = $${values.length}
     RETURNING ${STORE_PRICE_COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function isStorePriceSelectedByAnyProduct(id: number): Promise<boolean> {
  const { rows } = await pool.query(`SELECT id FROM products WHERE selected_store_price_id = $1`, [id]);
  return rows.length > 0;
}

export async function deleteStorePrice(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM store_prices WHERE id = $1`, [id]);
  return rowCount ?? 0;
}
