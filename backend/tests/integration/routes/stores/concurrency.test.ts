import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor, createProduct, createStore } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

// Deadlocks only show up under contention, so these run several rounds of simultaneous
// requests and require that none of them ends in a 500.
describe('stores under concurrent writes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  const admin = authHeaderFor('admin');
  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, headers: admin, payload: payload as object });
  const createProductReq = (name: string, stores: string[]) =>
    post('/products', { name, sale_price: 1000, store_prices: stores.map((s, i) => ({ store_name: s, price: 100 + i, selected: i === 0 })) });
  const storeCount = async () => (await pool.query(`SELECT COUNT(*)::int AS n FROM stores`)).rows[0].n as number;

  it('creating products that use the same new stores in opposite order never deadlocks', async () => {
    for (let round = 0; round < 12; round++) {
      const a = `Round${round}-A`;
      const b = `Round${round}-B`;
      const responses = await Promise.all([
        createProductReq(`p${round}-1`, [a, b]),
        createProductReq(`p${round}-2`, [b, a]),
        createProductReq(`p${round}-3`, [a, b]),
        createProductReq(`p${round}-4`, [b, a]),
        createProductReq(`p${round}-5`, [a, b]),
        createProductReq(`p${round}-6`, [b, a]),
      ]);
      expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201, 201, 201, 201]);
    }
    // And the same name in different spellings still gives one store each, never duplicates.
    expect(await storeCount()).toBe(24);
  });

  it('simultaneous creates of the same store name from every route end with exactly one store', async () => {
    for (let round = 0; round < 8; round++) {
      const name = `Shared${round}`;
      const seed = await createProduct({ name: `seed${round}`, sale_price: 100, store_prices: [{ store_name: 'Base', price: 10, selected: true }] });
      const responses = await Promise.all([
        post('/stores', { name }),
        post(`/products/${seed.id}/store-prices`, { store_name: name.toUpperCase(), price: 50 }),
        createProductReq(`q${round}`, [name.toLowerCase()]),
        createProductReq(`r${round}`, [` ${name} `]),
      ]);
      // POST /stores may legitimately lose the race and get a 409; nothing may be a 500.
      for (const r of responses) expect([200, 201, 409]).toContain(r.statusCode);
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM stores WHERE lower(name) = lower($1)`, [name]);
      expect(rows[0].n).toBe(1);
    }
  });

  it('a merge racing price and product creates at the same stores never ends in a 500', async () => {
    for (let round = 0; round < 12; round++) {
      const x = await createStore(`X${round}`);
      const y = await createStore(`Y${round}`);
      const product = await createProduct({ name: `base${round}`, sale_price: 100, store_prices: [{ store_name: 'Home', price: 10, selected: true }] });
      const responses = await Promise.all([
        post(`/stores/${x.id}/merge`, { into: y.id }),
        post(`/products/${product.id}/store-prices`, { store_name: `X${round}`, price: 70 }),
        createProductReq(`m${round}-1`, [`X${round}`, `Y${round}`]),
        createProductReq(`m${round}-2`, [`Y${round}`, `X${round}`]),
        post(`/products/${product.id}/store-prices`, { store_name: `Y${round}`, price: 80 }),
      ]);
      for (const r of responses) expect(r.statusCode, r.body).toBeLessThan(500);
    }
  });

  it('merging two stores into each other at the same time never deadlocks', async () => {
    for (let round = 0; round < 12; round++) {
      const x = await createStore(`MX${round}`);
      const y = await createStore(`MY${round}`);
      await createProduct({ name: `m${round}a`, sale_price: 100, store_prices: [{ store_name: `MX${round}`, price: 10, selected: true }] });
      await createProduct({ name: `m${round}b`, sale_price: 100, store_prices: [{ store_name: `MY${round}`, price: 10, selected: true }] });
      const responses = await Promise.all([post(`/stores/${x.id}/merge`, { into: y.id }), post(`/stores/${y.id}/merge`, { into: x.id })]);
      for (const r of responses) expect(r.statusCode, r.body).toBeLessThan(500);
    }
  });

  // Deleting a store removes its prices; a product that is switching its sale source to one
  // of them at the same moment makes the database refuse. That is a conflict (409), not a crash.
  it('deleting a store while a product is switching its sale source to it answers 409, not 500', async () => {
    const product = await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'Home', price: 10, selected: true }, { store_name: 'Target', price: 20 }] });
    const { rows } = await pool.query(`SELECT sp.id AS price_id, s.id AS store_id FROM store_prices sp JOIN stores s ON s.id = sp.store_id WHERE s.name = 'Target'`);

    const other = await pool.connect();
    try {
      await other.query('BEGIN');
      await other.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = $2`, [rows[0].price_id, product.id]);
      const pending = app.inject({ method: 'DELETE', url: `/stores/${rows[0].store_id}`, headers: admin });
      await new Promise((resolve) => setTimeout(resolve, 300));
      await other.query('COMMIT');

      const response = await pending;
      expect(response.statusCode, response.body).toBe(409);
    } finally {
      other.release();
    }
    const { rows: prices } = await pool.query(`SELECT COUNT(*)::int AS n FROM store_prices`);
    expect(prices[0].n).toBe(2);
  });

  // The merge checks for conflicts first, but a price can appear between that check and the move.
  // The unique (product, store) constraint is what makes that safe; it must surface as a 409.
  it('a merge that meets a price created a moment earlier at the target store answers 409, not 500, and moves nothing', async () => {
    const x = await createStore('From');
    const y = await createStore('Into');
    const product = await createProduct({ name: 'Coke', sale_price: 8500, store_prices: [{ store_name: 'From', price: 10, selected: true }, { store_name: 'Home', price: 20 }] });

    const other = await pool.connect();
    try {
      await other.query('BEGIN');
      await other.query(`INSERT INTO store_prices (product_id, store_id, price) VALUES ($1, $2, 99)`, [product.id, y.id]);
      const pending = post(`/stores/${x.id}/merge`, { into: y.id });
      await new Promise((resolve) => setTimeout(resolve, 300));
      await other.query('COMMIT');

      const response = await pending;
      expect(response.statusCode, response.body).toBe(409);
    } finally {
      other.release();
    }
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM stores WHERE id = $1`, [x.id]);
    expect(rows[0].n).toBe(1);
  });

  // A merge locks stores then price rows; a price edit locks the price row then the store.
  // Opposite orders deadlock, and the database aborts one of them. That is a retryable 409.
  it('a merge racing price edits that move prices into the target never ends in a 500', async () => {
    for (let round = 0; round < 30; round++) {
      const x = await createStore(`EX${round}`);
      const y = await createStore(`EY${round}`);
      const products = [];
      for (let i = 0; i < 3; i++) {
        products.push(await createProduct({ name: `e${round}-${i}`, sale_price: 100, store_prices: [{ store_name: 'Home', price: 10, selected: true }, { store_name: `EX${round}`, price: 20 }] }));
      }
      const { rows } = await pool.query(`SELECT sp.id FROM store_prices sp WHERE sp.store_id = $1 ORDER BY sp.id`, [x.id]);
      const responses = await Promise.all([
        post(`/stores/${x.id}/merge`, { into: y.id }),
        ...rows.map((r) => app.inject({ method: 'PATCH', url: `/store-prices/${r.id}`, headers: admin, payload: { store_name: `EY${round}` } })),
      ]);
      for (const r of responses) expect(r.statusCode, r.body).toBeLessThan(500);
    }
  });

  it('a merge racing price creates at the target never ends in a 500, over many rounds', async () => {
    for (let round = 0; round < 40; round++) {
      const x = await createStore(`CX${round}`);
      const y = await createStore(`CY${round}`);
      const a = await createProduct({ name: `c${round}-a`, sale_price: 100, store_prices: [{ store_name: 'Home', price: 10, selected: true }, { store_name: `CX${round}`, price: 20 }] });
      const b = await createProduct({ name: `c${round}-b`, sale_price: 100, store_prices: [{ store_name: 'Home', price: 10, selected: true }] });
      const responses = await Promise.all([
        post(`/stores/${x.id}/merge`, { into: y.id }),
        post(`/products/${b.id}/store-prices`, { store_name: `CY${round}`, price: 70 }),
        post(`/products/${a.id}/store-prices`, { store_name: `CY${round}`, price: 80 }),
        createProductReq(`cc${round}`, [`CY${round}`, `CX${round}`]),
      ]);
      for (const r of responses) expect(r.statusCode, r.body).toBeLessThan(500);
    }
  });
});
