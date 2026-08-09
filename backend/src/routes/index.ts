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
import type { CreatePersonBody } from './persons/validation.js';
import type { CreateProductBody } from './products/validation.js';
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

  app.get('/persons', manageAccounts, persons.list);
  app.post<{ Body: CreatePersonBody }>('/persons', manageAccounts, persons.post);
  app.get<{ Querystring: { q?: string } }>('/persons/search', manageAccounts, persons.search);
  app.get<{ Params: { id: string } }>('/persons/:id/ledger', manageAccounts, persons.ledger);
  app.get<{ Params: { id: string } }>('/persons/:id/balance', manageAccounts, persons.balance);
  app.get<{ Params: { id: string } }>('/persons/:id', manageAccounts, persons.get);
  app.patch<{ Params: { id: string }; Body: UpdatePersonInput }>('/persons/:id', manageAccounts, persons.patch);
  app.delete<{ Params: { id: string } }>('/persons/:id', manageAccounts, persons.destroy);
  app.post<{ Params: { id: string }; Body: Partial<CreateLoanInput> }>(
    '/persons/:id/loans',
    manageAccounts,
    loans.createForPerson,
  );
  app.post<{ Params: { id: string }; Body: CreatePaymentBody }>(
    '/persons/:id/payments',
    manageAccounts,
    payments.createForPerson,
  );
  app.get<{ Params: { id: string } }>('/persons/:id/payments', manageAccounts, payments.listForPerson);

  app.get<{ Params: { id: string } }>('/loans/:id', manageAccounts, loans.get);
  app.get<{ Params: { id: string } }>('/loans/:id/history', manageAccounts, loans.history);
  app.patch<{ Params: { id: string }; Body: UpdateLoanInput }>('/loans/:id', manageAccounts, loans.patch);
  app.delete<{ Params: { id: string } }>('/loans/:id', manageAccounts, loans.destroy);

  app.get<{ Params: { id: string } }>('/loans/:id/line-items', manageAccounts, lineItems.listForLoan);
  app.post<{ Params: { id: string }; Body: Partial<CreateLineItemInput> }>(
    '/loans/:id/line-items',
    manageAccounts,
    lineItems.createForLoan,
  );
  app.get<{ Params: { id: string } }>('/line-items/:id', manageAccounts, lineItems.get);
  app.patch<{ Params: { id: string }; Body: UpdateLineItemInput }>(
    '/line-items/:id',
    manageAccounts,
    lineItems.patch,
  );
  app.delete<{ Params: { id: string } }>('/line-items/:id', manageAccounts, lineItems.destroy);

  app.get<{ Params: { id: string } }>('/payments/:id', manageAccounts, payments.get);
  app.patch<{ Params: { id: string }; Body: UpdatePaymentInput }>('/payments/:id', manageAccounts, payments.patch);
  app.delete<{ Params: { id: string } }>('/payments/:id', manageAccounts, payments.destroy);

  app.get('/products', authenticated, products.list);
  app.get<{ Querystring: { q?: string } }>('/products/search', authenticated, products.search);
  app.get<{ Params: { code: string } }>('/products/barcode/:code', authenticated, products.barcode.get);
  app.get<{ Params: { code: string } }>(
    '/products/barcode/:code/store-prices',
    manageAccounts,
    products.barcode.storePrices,
  );
  app.get<{ Params: { id: string } }>('/products/:id', authenticated, products.get);
  app.post<{ Body: CreateProductBody }>('/products', manageAccounts, products.post);
  app.patch<{ Params: { id: string }; Body: UpdateProductInput }>('/products/:id', manageAccounts, products.patch);
  app.delete<{ Params: { id: string } }>('/products/:id', manageAccounts, products.destroy);

  app.get<{ Params: { id: string } }>('/products/:id/store-prices', manageAccounts, storePrices.listForProduct);
  app.post<{ Params: { id: string }; Body: CreateStorePriceBody }>(
    '/products/:id/store-prices',
    manageAccounts,
    storePrices.createForProduct,
  );
  app.get<{ Params: { id: string } }>('/store-prices/:id', manageAccounts, storePrices.get);
  app.patch<{ Params: { id: string }; Body: UpdateStorePriceInput }>(
    '/store-prices/:id',
    manageAccounts,
    storePrices.patch,
  );
  app.delete<{ Params: { id: string } }>('/store-prices/:id', manageAccounts, storePrices.destroy);
}
