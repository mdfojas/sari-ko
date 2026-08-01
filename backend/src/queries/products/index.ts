import type { PoolClient } from 'pg';
import { pool } from '../../shared/db.js';
import { withTransaction } from '../../shared/transaction.js';

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

const PRODUCT_SELECT = `
  SELECT
    p.id, p.name, p.other_names, p.barcode, p.sale_price, p.selected_store_price_id,
    sp.price AS original_price,
    p.created_at, p.updated_at
  FROM products p
  LEFT JOIN store_prices sp ON sp.id = p.selected_store_price_id
`;

export interface CreateStorePriceInput {
  store_name: string;
  price: number;
  selected?: boolean;
}

export interface CreateProductInput {
  name: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  store_prices: CreateStorePriceInput[];
}

export interface UpdateProductInput {
  name?: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  selected_store_price_id?: number;
}

export async function listProducts() {
  const { rows } = await pool.query(`${PRODUCT_SELECT} ORDER BY p.id`);
  return rows;
}

export async function findProductById(id: number) {
  const { rows } = await pool.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function searchProducts(q: string) {
  const { rows } = await pool.query(
    `${PRODUCT_SELECT}
     WHERE p.name ILIKE '%' || $1 || '%'
        OR EXISTS (SELECT 1 FROM unnest(p.other_names) AS alias WHERE alias ILIKE '%' || $1 || '%')
     ORDER BY p.id`,
    [q],
  );
  return rows;
}

export async function findProductByBarcode(code: string) {
  const { rows } = await pool.query(`${PRODUCT_SELECT} WHERE p.barcode = $1`, [code]);
  return rows[0] ?? null;
}

export async function findProductSummaryByBarcode(code: string) {
  const { rows } = await pool.query(`SELECT id, name FROM products WHERE barcode = $1`, [code]);
  return rows[0] ?? null;
}

export async function createProduct(input: CreateProductInput): Promise<number> {
  return withTransaction(pool, async (client: PoolClient) => {
    const columns = ['name', 'other_names', 'barcode'];
    const values: unknown[] = [input.name, input.other_names ?? [], input.barcode ?? null];
    if (input.sale_price !== undefined) {
      columns.push('sale_price');
      values.push(input.sale_price);
    }
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const { rows: productRows } = await client.query(
      `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      values,
    );
    const productId = productRows[0].id;

    const selectedIndex = input.store_prices.findIndex((sp) => sp.selected);
    let selectedStorePriceId: number | null = null;
    for (const [index, storePrice] of input.store_prices.entries()) {
      const { rows: priceRows } = await client.query(
        `INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, $2, $3) RETURNING id`,
        [productId, storePrice.store_name, storePrice.price],
      );
      if (index === selectedIndex) {
        selectedStorePriceId = priceRows[0].id;
      }
    }

    await client.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = $2`, [
      selectedStorePriceId,
      productId,
    ]);

    return productId;
  });
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<number> {
  const columns: string[] = [];
  const values: unknown[] = [];
  const setField = (column: string, value: unknown) => {
    values.push(value);
    columns.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) setField('name', input.name);
  if (input.other_names !== undefined) setField('other_names', input.other_names);
  if (input.barcode !== undefined) setField('barcode', input.barcode);
  if (input.sale_price !== undefined) setField('sale_price', input.sale_price);
  if (input.selected_store_price_id !== undefined) {
    setField('selected_store_price_id', input.selected_store_price_id);
  }

  setField('updated_at', new Date());
  values.push(id);

  const { rowCount } = await pool.query(
    `UPDATE products SET ${columns.join(', ')} WHERE id = $${values.length}`,
    values,
  );
  return rowCount ?? 0;
}

export async function deleteProduct(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM products WHERE id = $1`, [id]);
  return rowCount ?? 0;
}
