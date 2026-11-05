import { pool } from '../../shared/db.js';
import { buildSetClause } from '../../shared/sql.js';
import { withTransaction } from '../../shared/transaction.js';
import { isUniqueViolation } from '../../shared/pg-errors.js';
import { findOrCreateStore, listStoreNames, lockStoresShared } from '../stores/index.js';

// Thrown inside the update's transaction so it rolls back (nothing, not even a new store, is kept).
class StorePriceNotFoundError extends Error {}

// A product can have only one price per store (unique product + store).
export class DuplicateStorePriceError extends Error {
  constructor(store: string) {
    super(`This product already has a price at "${store}". Edit that price instead.`);
  }
}

const isDuplicateStorePrice = (err: unknown) =>
  isUniqueViolation(err) && (err as { constraint?: string }).constraint === 'store_prices_product_store_key';

// The stored spelling of the store a typed name refers to, for the error message.
async function canonicalStoreName(name: string): Promise<string> {
  const { rows } = await pool.query(`SELECT name FROM stores WHERE lower(name) = lower($1)`, [name.trim()]);
  return rows[0]?.name ?? name.trim();
}

// A store price names its store (store_name) and also exposes the store's id.
const STORE_PRICE_SELECT = `
  SELECT sp.id, sp.product_id, sp.store_id, s.name AS store_name, sp.price, sp.created_at, sp.updated_at
  FROM store_prices sp
  JOIN stores s ON s.id = sp.store_id
`;

export interface UpdateStorePriceInput {
  store_name?: string;
  price?: number;
}

export async function listStorePricesByProductId(productId: number) {
  const { rows } = await pool.query(`${STORE_PRICE_SELECT} WHERE sp.product_id = $1 ORDER BY sp.id`, [productId]);
  return rows;
}

// Every store, including one that has no price yet, so it can be picked.
export async function listDistinctStoreNames(): Promise<string[]> {
  return listStoreNames();
}

export async function createStorePrice(productId: number, storeName: string, price: number) {
  try {
    return await insertStorePrice(productId, storeName, price);
  } catch (err) {
    if (isDuplicateStorePrice(err)) throw new DuplicateStorePriceError(await canonicalStoreName(storeName));
    throw err;
  }
}

async function insertStorePrice(productId: number, storeName: string, price: number) {
  return withTransaction(pool, async (client) => {
    const storeId = await findOrCreateStore(client, storeName);
    await lockStoresShared(client, [storeId]);
    const { rows } = await client.query(
      `INSERT INTO store_prices (product_id, store_id, price) VALUES ($1, $2, $3) RETURNING id`,
      [productId, storeId, price],
    );
    const { rows: created } = await client.query(`${STORE_PRICE_SELECT} WHERE sp.id = $1`, [rows[0].id]);
    return created[0];
  });
}

export async function findStorePriceById(id: number) {
  const { rows } = await pool.query(`${STORE_PRICE_SELECT} WHERE sp.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateStorePrice(id: number, input: UpdateStorePriceInput) {
  try {
    return await applyStorePriceUpdate(id, input);
  } catch (err) {
    if (err instanceof StorePriceNotFoundError) return null;
    if (isDuplicateStorePrice(err) && input.store_name !== undefined) {
      throw new DuplicateStorePriceError(await canonicalStoreName(input.store_name));
    }
    throw err;
  }
}

async function applyStorePriceUpdate(id: number, input: UpdateStorePriceInput) {
  return withTransaction(pool, async (client) => {
    // The target store is found (or created) and locked BEFORE the price row is, the same order a
    // merge uses (stores, then prices), so an edit moving a price into a store that is being merged
    // cannot deadlock with it.
    const storeId = input.store_name !== undefined ? await findOrCreateStore(client, input.store_name) : undefined;
    if (storeId !== undefined) await lockStoresShared(client, [storeId]);

    // A missing price rolls the whole transaction back, so it never leaves a freshly created store behind.
    const { rows: existing } = await client.query(`SELECT 1 FROM store_prices WHERE id = $1 FOR UPDATE`, [id]);
    if (existing.length === 0) throw new StorePriceNotFoundError();

    const { setClause, values } = buildSetClause({
      store_id: storeId,
      price: input.price,
      updated_at: new Date(),
    });
    values.push(id);

    await client.query(`UPDATE store_prices SET ${setClause} WHERE id = $${values.length}`, values);
    const { rows } = await client.query(`${STORE_PRICE_SELECT} WHERE sp.id = $1`, [id]);
    return rows[0] ?? null;
  });
}

export async function isStorePriceSelectedByAnyProduct(id: number): Promise<boolean> {
  const { rows } = await pool.query(`SELECT id FROM products WHERE selected_store_price_id = $1`, [id]);
  return rows.length > 0;
}

export async function deleteStorePrice(id: number): Promise<number> {
  const { rowCount } = await pool.query(`DELETE FROM store_prices WHERE id = $1`, [id]);
  return rowCount ?? 0;
}
