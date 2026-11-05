import type { Pool, PoolClient } from 'pg';
import { pool } from '../../shared/db.js';
import { isForeignKeyViolation, isRetryableConflict, isUniqueViolation } from '../../shared/pg-errors.js';
import { withTransaction } from '../../shared/transaction.js';

export interface StoreRow {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface StoreSummary {
  id: number;
  name: string;
  price_count: number;
  // How many products take their sale price from a price at this store.
  selected_count: number;
}

export class StoreNotFoundError extends Error {
  constructor() {
    super('Store not found');
  }
}

// Store names are unique ignoring case (a unique index on lower(name)).
export class StoreExistsError extends Error {
  constructor(name: string, hint = '') {
    super(`A store called "${name}" already exists${hint}`);
  }
}

// Merging into a store that a product already has a price at would leave that product
// with two prices at the same store.
export class StoreMergeConflictError extends Error {
  constructor(products: number, target: string) {
    super(
      `${products} product${products === 1 ? '' : 's'} already ${products === 1 ? 'has' : 'have'} a price at "${target}". ` +
        'Delete or change those prices first.',
    );
  }
}

// The merge raced a concurrent change and the database refused it; nothing was changed.
export class StoreChangedError extends Error {
  constructor() {
    super('A store or one of its prices was just changed. Please try again.');
  }
}

export class StoreSelfMergeError extends Error {
  constructor() {
    super('A store cannot be merged into itself');
  }
}

// A store that is some product's sale-price source can't lose its prices
// (products.selected_store_price_id is ON DELETE RESTRICT).
export class StoreInUseError extends Error {
  constructor(store: string, products: number) {
    super(
      `"${store}" is the sale-price source for ${products} product${products === 1 ? '' : 's'}. ` +
        `Select another store price for ${products === 1 ? 'it' : 'them'} first.`,
    );
  }
}

const STORE_COLUMNS = 'id, name, created_at, updated_at';

// Ordered case-insensitively with a stable tie-break, so the order does not depend
// on the database's locale. Stores with no prices are listed too.
export async function listStores(): Promise<StoreSummary[]> {
  const { rows } = await pool.query(
    `SELECT s.id,
            s.name,
            (SELECT COUNT(*)::int FROM store_prices sp WHERE sp.store_id = s.id) AS price_count,
            (SELECT COUNT(*)::int
               FROM products p
               JOIN store_prices sp ON sp.id = p.selected_store_price_id
              WHERE sp.store_id = s.id) AS selected_count
       FROM stores s
      ORDER BY lower(s.name) COLLATE "C", s.name COLLATE "C"`,
  );
  return rows;
}

// The price each product has at one store (the id is the store price's own id). Used to
// filter the Store Prices list down to the products priced at a store.
export async function listPricesAtStore(storeId: number): Promise<{ id: number; product_id: number; price: number }[]> {
  const { rows: stores } = await pool.query(`SELECT 1 FROM stores WHERE id = $1`, [storeId]);
  if (stores.length === 0) throw new StoreNotFoundError();

  const { rows } = await pool.query(
    `SELECT id, product_id, price FROM store_prices WHERE store_id = $1 ORDER BY product_id, id`,
    [storeId],
  );
  return rows;
}

export async function listStoreNames(): Promise<string[]> {
  const { rows } = await pool.query(`SELECT name FROM stores ORDER BY lower(name) COLLATE "C", name COLLATE "C"`);
  return rows.map((row) => row.name);
}

// The store a typed name refers to, creating it if it is new. Matching ignores case, so
// "puregold" lands on "Puregold" instead of creating a look-alike.
//
// It looks the store up with a plain SELECT first, which takes no lock, and only inserts
// when there is none. An upsert (ON CONFLICT DO UPDATE) would lock the existing store row,
// and a merge or delete running at the same moment holds the price table and wants that row:
// each waits for the other and the database aborts one of them as a deadlock. The insert uses
// DO NOTHING, so losing a race to create the same name just means looking it up again.
export async function findOrCreateStore(client: Pool | PoolClient, name: string): Promise<number> {
  const trimmed = name.trim();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows: found } = await client.query(`SELECT id FROM stores WHERE lower(name) = lower($1)`, [trimmed]);
    if (found.length > 0) return found[0].id;

    const { rows: created } = await client.query(
      `INSERT INTO stores (name) VALUES ($1) ON CONFLICT ((lower(name))) DO NOTHING RETURNING id`,
      [trimmed],
    );
    if (created.length > 0) return created[0].id;
  }
  throw new Error(`Could not find or create the store "${trimmed}"`);
}

// Takes a shared lock on the stores a write is about to use, in id order. A merge or a delete
// locks the stores it touches (also in id order) before it touches any price, so every writer
// takes store locks first and in the same order, and none can end up holding a price row while
// waiting for a store that another holds while waiting for that price. A store that vanished
// between being found and being locked means the caller lost a race with a merge or delete.
export async function lockStoresShared(client: Pool | PoolClient, ids: number[]): Promise<void> {
  const unique = [...new Set(ids)];
  const { rows } = await client.query(`SELECT id FROM stores WHERE id = ANY($1::int[]) ORDER BY id FOR SHARE`, [unique]);
  if (rows.length !== unique.length) throw new StoreChangedError();
}

// Resolves several names in one fixed order (by lower-case name), whatever order they were
// given in. Two requests that both create new stores then always create them in the same
// order, so neither can end up waiting for a store the other holds while holding one it needs.
export async function findOrCreateStores(client: Pool | PoolClient, names: string[]): Promise<Map<string, number>> {
  const keys = [...new Set(names.map((n) => n.trim().toLowerCase()))].sort();
  const ids = new Map<string, number>();
  for (const key of keys) {
    const original = names.find((n) => n.trim().toLowerCase() === key) as string;
    ids.set(key, await findOrCreateStore(client, original));
  }
  return ids;
}

export async function createStore(name: string): Promise<StoreRow> {
  const trimmed = name.trim();
  try {
    const { rows } = await pool.query(`INSERT INTO stores (name) VALUES ($1) RETURNING ${STORE_COLUMNS}`, [trimmed]);
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new StoreExistsError(await existingName(trimmed));
    throw err;
  }
}

export async function renameStore(id: number, name: string): Promise<StoreRow> {
  const trimmed = name.trim();
  try {
    const { rows } = await pool.query(
      `UPDATE stores SET name = $2, updated_at = now() WHERE id = $1 RETURNING ${STORE_COLUMNS}`,
      [id, trimmed],
    );
    if (rows.length === 0) throw new StoreNotFoundError();
    return rows[0];
  } catch (err) {
    // The unique index also fires for another store with the same name, ignoring case.
    // Renaming a store to a different case of its own name is fine: it is the same row.
    if (isUniqueViolation(err)) {
      throw new StoreExistsError(await existingName(trimmed), '. Merge the two stores instead.');
    }
    throw err;
  }
}

// The stored spelling of the store a name collides with, for the error message.
async function existingName(name: string): Promise<string> {
  const { rows } = await pool.query(`SELECT name FROM stores WHERE lower(name) = lower($1)`, [name]);
  return rows[0]?.name ?? name;
}

// A lost race is never silent corruption, because the database enforces the rules itself: a
// product cannot get two prices at one store (unique product + store), a store with prices
// cannot be deleted (foreign key), and a price a product has selected cannot be deleted
// (foreign key). The checks below give a friendly message in the normal case; when a
// concurrent change slips in between a check and the write, the database refuses the write, the
// whole transaction rolls back, and the route answers 409 (try again). No table lock is taken,
// which also removes a source of deadlocks.
export async function mergeStore(fromId: number, intoId: number): Promise<{ moved: number }> {
  if (fromId === intoId) throw new StoreSelfMergeError();

  return withTransaction(pool, async (client) => {
    // Both stores are locked in id order, whichever way round the merge is going, so two merges
    // into each other (or one merge and a delete) queue up instead of deadlocking.
    const { rows: stores } = await client.query(
      `SELECT id, name FROM stores WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [[fromId, intoId]],
    );
    const target = stores.find((s) => s.id === intoId);
    if (stores.length !== 2 || !target) throw new StoreNotFoundError();

    const { rows: conflicts } = await client.query(
      `SELECT COUNT(DISTINCT a.product_id)::int AS products
         FROM store_prices a
         JOIN store_prices b ON b.product_id = a.product_id
        WHERE a.store_id = $1 AND b.store_id = $2`,
      [fromId, intoId],
    );
    if (conflicts[0].products > 0) throw new StoreMergeConflictError(conflicts[0].products, target.name);

    const { rowCount } = await client.query(
      `UPDATE store_prices SET store_id = $2, updated_at = now() WHERE store_id = $1`,
      [fromId, intoId],
    );
    await client.query(`DELETE FROM stores WHERE id = $1`, [fromId]);
    return { moved: rowCount ?? 0 };
  }).catch((err) => {
    if (isUniqueViolation(err) || isForeignKeyViolation(err) || isRetryableConflict(err)) throw new StoreChangedError();
    throw err;
  });
}

// Deletes the store and every price at it. Returns how many prices went with it.
export async function deleteStore(id: number): Promise<number> {
  return withTransaction(pool, async (client) => {
    const { rows: stores } = await client.query(`SELECT name FROM stores WHERE id = $1 FOR UPDATE`, [id]);
    if (stores.length === 0) throw new StoreNotFoundError();

    const { rows: inUse } = await client.query(
      `SELECT COUNT(*)::int AS products
         FROM products p
         JOIN store_prices sp ON sp.id = p.selected_store_price_id
        WHERE sp.store_id = $1`,
      [id],
    );
    if (inUse[0].products > 0) throw new StoreInUseError(stores[0].name, inUse[0].products);

    const { rowCount } = await client.query(`DELETE FROM store_prices WHERE store_id = $1`, [id]);
    await client.query(`DELETE FROM stores WHERE id = $1`, [id]);
    return rowCount ?? 0;
  });
}
