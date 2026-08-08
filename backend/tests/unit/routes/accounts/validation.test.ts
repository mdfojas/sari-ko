import { describe, expect, it } from 'vitest';
import { canManageAccountOfRole, validateCreateAccount } from '../../../../src/routes/accounts/validation.js';

describe('validateCreateAccount', () => {
  it('rejects a missing or invalid role', () => {
    expect(validateCreateAccount({})).toBeTruthy();
    expect(validateCreateAccount({ role: 'superuser' })).toBeTruthy();
  });

  it('requires person_id for a customer account', () => {
    expect(validateCreateAccount({ role: 'customer' })).toBeTruthy();
  });

  it('rejects person_id on a non-customer account', () => {
    expect(validateCreateAccount({ role: 'store_owner', username: 'owner1', person_id: 5 })).toBeTruthy();
  });

  it('requires an explicit username for admin/store_owner accounts', () => {
    expect(validateCreateAccount({ role: 'admin' })).toBeTruthy();
  });

  it('rejects a password under 8 characters when one is supplied', () => {
    expect(validateCreateAccount({ role: 'admin', username: 'admin1', password: 'short1' })).toBeTruthy();
  });

  it('accepts a valid customer account with no username/password (both optional)', () => {
    expect(validateCreateAccount({ role: 'customer', person_id: 5 })).toBeNull();
  });

  it('accepts a valid admin account with an explicit username', () => {
    expect(validateCreateAccount({ role: 'admin', username: 'admin1' })).toBeNull();
  });
});

describe('canManageAccountOfRole', () => {
  it('lets admin manage an account of any role', () => {
    expect(canManageAccountOfRole('admin', 'admin')).toBe(true);
    expect(canManageAccountOfRole('admin', 'store_owner')).toBe(true);
    expect(canManageAccountOfRole('admin', 'customer')).toBe(true);
  });

  it('lets store_owner manage only customer accounts', () => {
    expect(canManageAccountOfRole('store_owner', 'customer')).toBe(true);
    expect(canManageAccountOfRole('store_owner', 'admin')).toBe(false);
    expect(canManageAccountOfRole('store_owner', 'store_owner')).toBe(false);
  });

  it('never lets customer manage any account', () => {
    expect(canManageAccountOfRole('customer', 'customer')).toBe(false);
    expect(canManageAccountOfRole('customer', 'admin')).toBe(false);
  });
});
