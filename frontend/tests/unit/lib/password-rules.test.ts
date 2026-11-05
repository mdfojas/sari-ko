import { describe, expect, test } from 'vitest';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password-rules';

describe('isValidPassword', () => {
  test.each([
    ['1234567', false],
    ['12345678', true],
    ['abcdefghijklmnop', true],
    ['abcdefghijklmnopq', false],
    ['', false],
  ])('"%s" -> %s (8-16 characters, no other rules)', (password, expected) => {
    expect(isValidPassword(password)).toBe(expected);
  });

  test('has a message describing the rule', () => {
    expect(PASSWORD_RULE_MESSAGE).toMatch(/8/);
    expect(PASSWORD_RULE_MESSAGE).toMatch(/16/);
  });
});
