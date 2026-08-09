import type { FastifyInstance } from 'fastify';
import * as products from './products/index.js';
import * as storePrices from './store-prices/index.js';
import * as persons from './persons/index.js';
import * as loans from './loans/index.js';
import * as lineItems from './line-items/index.js';
import * as payments from './payments/index.js';
import * as accounts from './accounts/index.js';
import * as auth from './auth/index.js';
import * as me from './me/index.js';
import type { UpdateProductInput } from '../queries/products/index.js';
import type { UpdateStorePriceInput } from '../queries/store-prices/index.js';
import type { UpdatePersonInput } from '../queries/persons/index.js';
import type { CreateLoanInput, UpdateLoanInput } from '../queries/loans/index.js';
import type { CreateLineItemInput, UpdateLineItemInput } from '../queries/line-items/index.js';
import type { CreateStorePriceBody } from './store-prices/index.js';
import type { CreatePaymentBody } from './payments/validation.js';
import type { UpdatePaymentInput } from '../queries/payments/index.js';
import type { CreateAccountBody } from './accounts/validation.js';
import type { ResetPasswordBody } from './accounts/reset-password.js';
import type { LoginBody } from './auth/validation.js';
import type { ChangePasswordBody, ChangeUsernameBody } from './me/validation.js';
import { requireAuth, requireRole } from '../shared/auth/guards.js';

const manageAccounts = { preHandler: [requireAuth, requireRole('admin', 'store_owner')] };
const authenticated = { preHandler: [requireAuth] };
const customerOnly = { preHandler: [requireAuth, requireRole('customer')] };

export default async function routes(app: FastifyInstance) {
  app.post<{ Body: LoginBody }>('/auth/login', auth.login);
  app.get('/me', authenticated, me.get);
  app.patch<{ Body: ChangePasswordBody }>('/me/password', authenticated, me.changePassword);
  app.patch<{ Body: ChangeUsernameBody }>('/me/username', authenticated, me.changeUsername);
  app.get('/me/ledger', customerOnly, me.ledger);
  app.get('/me/balance', customerOnly, me.balance);
  app.get('/me/payments', customerOnly, me.payments);
  app.get<{ Params: { id: string } }>('/me/loans/:id', customerOnly, me.loan);
  app.get<{ Params: { id: string } }>('/me/loans/:id/line-items', customerOnly, me.loanLineItems);
  app.get<{ Params: { id: string } }>('/me/loans/:id/history', customerOnly, me.loanHistory);

  app.post<{ Body: CreateAccountBody }>('/accounts', manageAccounts, accounts.post);
  app.get('/accounts', manageAccounts, accounts.list);
  app.get<{ Params: { id: string } }>('/accounts/:id', manageAccounts, accounts.get);
  app.delete<{ Params: { id: string } }>('/accounts/:id', manageAccounts, accounts.destroy);
  app.patch<{ Params: { id: string }; Body: ResetPasswordBody }>(
    '/accounts/:id/password',
    manageAccounts,
    accounts.resetPassword,
  );

  app.get('/persons', persons.list);
  app.post('/persons', persons.post);
  app.get<{ Querystring: { q?: string } }>('/persons/search', persons.search);
  app.get<{ Params: { id: string } }>('/persons/:id/ledger', persons.ledger);
  app.get<{ Params: { id: string } }>('/persons/:id/balance', persons.balance);
  app.get<{ Params: { id: string } }>('/persons/:id', persons.get);
  app.patch<{ Params: { id: string }; Body: UpdatePersonInput }>('/persons/:id', persons.patch);
  app.delete<{ Params: { id: string } }>('/persons/:id', persons.destroy);
  app.post<{ Params: { id: string }; Body: Partial<CreateLoanInput> }>(
    '/persons/:id/loans',
    loans.createForPerson,
  );
  app.post<{ Params: { id: string }; Body: CreatePaymentBody }>(
    '/persons/:id/payments',
    payments.createForPerson,
  );
  app.get<{ Params: { id: string } }>('/persons/:id/payments', payments.listForPerson);

  app.get<{ Params: { id: string } }>('/loans/:id', loans.get);
  app.get<{ Params: { id: string } }>('/loans/:id/history', loans.history);
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

  app.get<{ Params: { id: string } }>('/payments/:id', payments.get);
  app.patch<{ Params: { id: string }; Body: UpdatePaymentInput }>('/payments/:id', payments.patch);
  app.delete<{ Params: { id: string } }>('/payments/:id', payments.destroy);

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
