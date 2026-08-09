import { describe, expect, it } from 'vitest';
import { validateLogin } from '../../../../src/routes/auth/validation.js';

describe('validateLogin', () => {
  it('rejects a missing username', () => {
    expect(validateLogin({ password: 'whatever1' })).toBeTruthy();
  });

  it('rejects a missing password', () => {
    expect(validateLogin({ username: 'owner1' })).toBeTruthy();
  });

  it('accepts a body with both fields present', () => {
    expect(validateLogin({ username: 'owner1', password: 'whatever1' })).toBeNull();
  });
});
