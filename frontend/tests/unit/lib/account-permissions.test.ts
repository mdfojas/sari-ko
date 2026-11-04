import { describe, expect, test } from 'vitest';
import { canManageAccountOfRole, isLastAdmin } from '@/lib/account-permissions';
import type { Account } from '@/lib/accounts-client';

const account = (id: number, role: Account['role']): Account => ({
  id,
  username: `user${id}`,
  role,
  person_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('canManageAccountOfRole', () => {
  test('admin can manage every role', () => {
    expect(canManageAccountOfRole('admin', 'admin')).toBe(true);
    expect(canManageAccountOfRole('admin', 'store_owner')).toBe(true);
    expect(canManageAccountOfRole('admin', 'customer')).toBe(true);
  });

  test('store_owner can manage customers only', () => {
    expect(canManageAccountOfRole('store_owner', 'customer')).toBe(true);
    expect(canManageAccountOfRole('store_owner', 'store_owner')).toBe(false);
    expect(canManageAccountOfRole('store_owner', 'admin')).toBe(false);
  });

  test('customer can manage nothing', () => {
    expect(canManageAccountOfRole('customer', 'customer')).toBe(false);
    expect(canManageAccountOfRole('customer', 'admin')).toBe(false);
  });
});

describe('isLastAdmin', () => {
  test('true for the only admin account', () => {
    const accounts = [account(1, 'admin'), account(2, 'customer')];
    expect(isLastAdmin(accounts, accounts[0])).toBe(true);
  });

  test('false when another admin exists', () => {
    const accounts = [account(1, 'admin'), account(2, 'admin')];
    expect(isLastAdmin(accounts, accounts[0])).toBe(false);
  });

  test('false for a non-admin account, even with a single admin', () => {
    const accounts = [account(1, 'admin'), account(2, 'store_owner')];
    expect(isLastAdmin(accounts, accounts[1])).toBe(false);
  });
});
