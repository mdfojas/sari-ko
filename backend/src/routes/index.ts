import type { FastifyInstance } from 'fastify';
import * as products from './products/index.js';
import * as storePrices from './store-prices/index.js';
import * as persons from './persons/index.js';
import * as loans from './loans/index.js';
import * as lineItems from './line-items/index.js';
import type { UpdateProductInput } from '../queries/products/index.js';
import type { UpdateStorePriceInput } from '../queries/store-prices/index.js';
import type { UpdatePersonInput } from '../queries/persons/index.js';
import type { CreateLoanInput, UpdateLoanInput } from '../queries/loans/index.js';
import type { CreateLineItemInput, UpdateLineItemInput } from '../queries/line-items/index.js';
import type { CreateStorePriceBody } from './store-prices/index.js';

export default async function routes(app: FastifyInstance) {
  app.get('/persons', persons.list);
  app.post('/persons', persons.post);
  app.get<{ Querystring: { q?: string } }>('/persons/search', persons.search);
  app.get<{ Params: { id: string } }>('/persons/:id', persons.get);
  app.patch<{ Params: { id: string }; Body: UpdatePersonInput }>('/persons/:id', persons.patch);
  app.delete<{ Params: { id: string } }>('/persons/:id', persons.destroy);
  app.post<{ Params: { id: string }; Body: Partial<CreateLoanInput> }>(
    '/persons/:id/loans',
    loans.createForPerson,
  );

  app.get<{ Params: { id: string } }>('/loans/:id', loans.get);
  app.patch<{ Params: { id: string }; Body: UpdateLoanInput }>('/loans/:id', loans.patch);
  app.delete<{ Params: { id: string } }>('/loans/:id', loans.destroy);

  app.get<{ Params: { id: string } }>('/loans/:id/line-items', lineItems.listForLoan);
  app.post<{ Params: { id: string }; Body: Partial<CreateLineItemInput> }>(
    '/loans/:id/line-items',
    lineItems.createForLoan,
  );
  app.get<{ Params: { id: string } }>('/line-items/:id', lineItems.get);
  app.patch<{ Params: { id: string }; Body: UpdateLineItemInput }>('/line-items/:id', lineItems.patch);
  app.delete<{ Params: { id: string } }>('/line-items/:id', lineItems.destroy);

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
