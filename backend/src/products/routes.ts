import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { pool } from '../shared/db.js';
import { withTransaction } from '../shared/transaction.js';

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
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

async function findProductById(id: number) {
  const { rows } = await pool.query(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ?? null;
}

interface CreateStorePriceInput {
  store_name: string;
  price: number;
  selected?: boolean;
}

interface CreateProductBody {
  name?: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  store_prices?: CreateStorePriceInput[];
}

export default async function productRoutes(app: FastifyInstance) {
  app.get('/products', async () => {
    const { rows } = await pool.query(`${PRODUCT_SELECT} ORDER BY p.id`);
    return rows;
  });

  app.get<{ Querystring: { q?: string } }>('/products/search', async (request) => {
    const q = request.query.q ?? '';
    const { rows } = await pool.query(
      `${PRODUCT_SELECT}
       WHERE p.name ILIKE '%' || $1 || '%'
          OR EXISTS (SELECT 1 FROM unnest(p.other_names) AS alias WHERE alias ILIKE '%' || $1 || '%')
       ORDER BY p.id`,
      [q],
    );
    return rows;
  });

  app.get<{ Params: { code: string } }>('/products/barcode/:code', async (request, reply) => {
    const { rows } = await pool.query(`${PRODUCT_SELECT} WHERE p.barcode = $1`, [request.params.code]);
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    return rows[0];
  });

  app.get<{ Params: { code: string } }>('/products/barcode/:code/store-prices', async (request, reply) => {
    const { rows: productRows } = await pool.query(`SELECT id, name FROM products WHERE barcode = $1`, [
      request.params.code,
    ]);
    if (productRows.length === 0) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    const product = productRows[0];
    const { rows: storePrices } = await pool.query(
      `SELECT id, product_id, store_name, price, created_at, updated_at
       FROM store_prices WHERE product_id = $1 ORDER BY id`,
      [product.id],
    );
    return { product, store_prices: storePrices };
  });

  app.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
    const product = await findProductById(Number(request.params.id));
    if (!product) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    return product;
  });

  app.post<{ Body: CreateProductBody }>('/products', async (request, reply) => {
    const body = request.body;
    const storePrices = body.store_prices ?? [];

    if (!body.name) {
      return reply.code(400).send({ error: 'name is required' });
    }
    if (storePrices.length < 1) {
      return reply.code(400).send({ error: 'At least one store price is required' });
    }
    const selectedIndex = storePrices.findIndex((sp) => sp.selected);
    if (selectedIndex === -1) {
      return reply.code(400).send({ error: 'One store price must be marked as selected' });
    }

    try {
      const productId = await withTransaction(pool, async (client: PoolClient) => {
        const columns = ['name', 'other_names', 'barcode'];
        const values: unknown[] = [body.name, body.other_names ?? [], body.barcode ?? null];
        if (body.sale_price !== undefined) {
          columns.push('sale_price');
          values.push(body.sale_price);
        }
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const { rows: productRows } = await client.query(
          `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
          values,
        );
        const newProductId = productRows[0].id;

        let selectedStorePriceId: number | null = null;
        for (const [index, storePrice] of storePrices.entries()) {
          const { rows: priceRows } = await client.query(
            `INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, $2, $3) RETURNING id`,
            [newProductId, storePrice.store_name, storePrice.price],
          );
          if (index === selectedIndex) {
            selectedStorePriceId = priceRows[0].id;
          }
        }

        await client.query(`UPDATE products SET selected_store_price_id = $1 WHERE id = $2`, [
          selectedStorePriceId,
          newProductId,
        ]);

        return newProductId;
      });

      const product = await findProductById(productId);
      return reply.code(201).send(product);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply.code(409).send({ error: 'A product with this barcode already exists' });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string }; Body: Partial<CreateProductBody> & { selected_store_price_id?: number } }>(
    '/products/:id',
    async (request, reply) => {
      const id = Number(request.params.id);
      const body = request.body;

      const columns: string[] = [];
      const values: unknown[] = [];
      const setField = (column: string, value: unknown) => {
        values.push(value);
        columns.push(`${column} = $${values.length}`);
      };

      if (body.name !== undefined) setField('name', body.name);
      if (body.other_names !== undefined) setField('other_names', body.other_names);
      if (body.barcode !== undefined) setField('barcode', body.barcode);
      if (body.sale_price !== undefined) setField('sale_price', body.sale_price);
      if (body.selected_store_price_id !== undefined) {
        setField('selected_store_price_id', body.selected_store_price_id);
      }

      if (columns.length === 0) {
        return reply.code(400).send({ error: 'No updatable fields provided' });
      }

      setField('updated_at', new Date());
      values.push(id);

      try {
        const { rowCount } = await pool.query(
          `UPDATE products SET ${columns.join(', ')} WHERE id = $${values.length}`,
          values,
        );
        if (rowCount === 0) {
          return reply.code(404).send({ error: 'Product not found' });
        }
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ error: 'A product with this barcode already exists' });
        }
        throw err;
      }

      return findProductById(id);
    },
  );

  app.delete<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
    const { rowCount } = await pool.query(`DELETE FROM products WHERE id = $1`, [Number(request.params.id)]);
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Product not found' });
    }
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/products/:id/store-prices', async (request) => {
    const { rows } = await pool.query(
      `SELECT id, product_id, store_name, price, created_at, updated_at
       FROM store_prices WHERE product_id = $1 ORDER BY id`,
      [Number(request.params.id)],
    );
    return rows;
  });

  app.post<{ Params: { id: string }; Body: { store_name?: string; price?: number } }>(
    '/products/:id/store-prices',
    async (request, reply) => {
      const productId = Number(request.params.id);
      const { store_name, price } = request.body;

      if (!store_name || price === undefined) {
        return reply.code(400).send({ error: 'store_name and price are required' });
      }

      const product = await findProductById(productId);
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      const { rows } = await pool.query(
        `INSERT INTO store_prices (product_id, store_name, price) VALUES ($1, $2, $3)
         RETURNING id, product_id, store_name, price, created_at, updated_at`,
        [productId, store_name, price],
      );
      return reply.code(201).send(rows[0]);
    },
  );

  app.get<{ Params: { id: string } }>('/store-prices/:id', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT id, product_id, store_name, price, created_at, updated_at FROM store_prices WHERE id = $1`,
      [Number(request.params.id)],
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Store price not found' });
    }
    return rows[0];
  });

  app.patch<{ Params: { id: string }; Body: { store_name?: string; price?: number } }>(
    '/store-prices/:id',
    async (request, reply) => {
      const id = Number(request.params.id);
      const { store_name, price } = request.body;

      const columns: string[] = [];
      const values: unknown[] = [];
      const setField = (column: string, value: unknown) => {
        values.push(value);
        columns.push(`${column} = $${values.length}`);
      };

      if (store_name !== undefined) setField('store_name', store_name);
      if (price !== undefined) setField('price', price);

      if (columns.length === 0) {
        return reply.code(400).send({ error: 'No updatable fields provided' });
      }

      setField('updated_at', new Date());
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE store_prices SET ${columns.join(', ')} WHERE id = $${values.length}
         RETURNING id, product_id, store_name, price, created_at, updated_at`,
        values,
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Store price not found' });
      }
      return rows[0];
    },
  );

  app.delete<{ Params: { id: string } }>('/store-prices/:id', async (request, reply) => {
    const id = Number(request.params.id);

    const { rows: selectedRows } = await pool.query(`SELECT id FROM products WHERE selected_store_price_id = $1`, [
      id,
    ]);
    if (selectedRows.length > 0) {
      return reply
        .code(409)
        .send({ error: 'Cannot delete a store price that is currently selected for a product' });
    }

    const { rowCount } = await pool.query(`DELETE FROM store_prices WHERE id = $1`, [id]);
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Store price not found' });
    }
    return reply.code(204).send();
  });
}
