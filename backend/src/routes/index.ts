import type { FastifyInstance } from 'fastify';
import * as products from './products/index.js';
import * as storePrices from './store-prices/index.js';
import type { UpdateProductInput } from '../queries/products/index.js';
import type { UpdateStorePriceInput } from '../queries/store-prices/index.js';
import type { CreateStorePriceBody } from './store-prices/index.js';

export default async function routes(app: FastifyInstance) {
  app.get('/products', products.list);
  app.get<{ Querystring: { q?: string } }>('/products/search', products.search);
  app.get<{ Params: { code: string } }>('/products/barcode/:code', products.barcode.get);
  app.get<{ Params: { code: string } }>('/products/barcode/:code/store-prices', products.barcode.storePrices);
  app.get<{ Params: { id: string } }>('/products/:id', products.get);
  app.post('/products', products.post);
  app.patch<{ Params: { id: string }; Body: UpdateProductInput }>('/products/:id', products.patch);
  app.delete<{ Params: { id: string } }>('/products/:id', products.destroy);

  app.get<{ Params: { id: string } }>('/products/:id/store-prices', storePrices.listForProduct);
  app.post<{ Params: { id: string }; Body: CreateStorePriceBody }>(
    '/products/:id/store-prices',
    storePrices.createForProduct,
  );
  app.get<{ Params: { id: string } }>('/store-prices/:id', storePrices.get);
  app.patch<{ Params: { id: string }; Body: UpdateStorePriceInput }>('/store-prices/:id', storePrices.patch);
  app.delete<{ Params: { id: string } }>('/store-prices/:id', storePrices.destroy);
}
