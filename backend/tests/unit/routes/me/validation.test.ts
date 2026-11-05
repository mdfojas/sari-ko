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

describe('validateChangeUsername, stricter', () => {
  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%j)', (body) => {
    expect(validateChangeUsername(body as never)).toBe('Request body must be a JSON object');
  });

  it.each([123, '', '   ', {}, null])('rejects the username %j', (username) => {
    expect(validateChangeUsername({ username } as never)).toBeTruthy();
  });

  it('rejects an over-long username and a NUL byte', () => {
    expect(validateChangeUsername({ username: 'x'.repeat(51) })).toBe('username can be at most 50 characters');
    expect(validateChangeUsername({ username: 'a\u0000b' })).toBe('Text cannot contain NUL characters');
  });
});

describe('validateChangePassword, stricter', () => {
  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%j)', (body) => {
    expect(validateChangePassword(body as never)).toBe('Request body must be a JSON object');
  });

  it.each([123, {}, ['a', 'b'], true])('rejects a non-text currentPassword (%j)', (currentPassword) => {
    expect(validateChangePassword({ currentPassword, newPassword: 'brand-new-pass' } as never)).toBe(
      'currentPassword and newPassword must be text',
    );
  });

  it.each([12345678, {}, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], true])('rejects a non-text newPassword (%j)', (newPassword) => {
    expect(validateChangePassword({ currentPassword: 'old-password', newPassword } as never)).toBe(
      'currentPassword and newPassword must be text',
    );
  });
});
});
