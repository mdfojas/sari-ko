import { describe, expect, it } from 'vitest';
import { validateChangePassword, validateChangeUsername } from '../../../../src/routes/me/validation.js';

describe('validateChangePassword', () => {
  it('rejects a missing currentPassword', () => {
    expect(validateChangePassword({ newPassword: 'brand-new-pass' })).toBeTruthy();
  });

  it('rejects a missing newPassword', () => {
    expect(validateChangePassword({ currentPassword: 'old-password' })).toBeTruthy();
  });

  it('rejects a newPassword under 8 characters', () => {
    expect(validateChangePassword({ currentPassword: 'old-password', newPassword: 'short1' })).toBeTruthy();
  });

  it('accepts a valid body', () => {
    expect(validateChangePassword({ currentPassword: 'old-password', newPassword: 'brand-new-pass' })).toBeNull();
  });
});

describe('validateChangeUsername', () => {
  it('rejects a missing username', () => {
    expect(validateChangeUsername({})).toBeTruthy();
  });

  it('accepts a valid body', () => {
    expect(validateChangeUsername({ username: 'newname1' })).toBeNull();
  });
});
