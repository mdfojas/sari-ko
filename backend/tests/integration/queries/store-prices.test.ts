import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createStorePrice } from '../../../src/queries/store-prices/index.js';
import { pool } from '../../../src/shared/db.js';
import { resetDatabase } from '../../reset-db.js';

describe('createStorePrice atomicity', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  // The store is created in the same transaction as the price, so a price that cannot be
  // saved (here: the product does not exist) leaves no store behind.
  it('leaves no new store behind when the price cannot be saved', async () => {
    await expect(createStorePrice(999999, 'Ghost Store', 100)).rejects.toMatchObject({ code: '23503' });

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM stores`);
    expect(rows[0].n).toBe(0);
  });
});
