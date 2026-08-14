import type { Account } from '../../queries/accounts/index.js';

export type PublicAccount = Omit<Account, 'password_hash'>;

export function toPublicAccount(account: Account): PublicAccount {
  const { password_hash: _passwordHash, ...rest } = account;
  return rest;
}
