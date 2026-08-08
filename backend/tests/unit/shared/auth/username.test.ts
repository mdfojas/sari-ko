import { describe, expect, it } from 'vitest';
import { generateUsername } from '../../../../src/shared/auth/username.js';

describe('generateUsername', () => {
  it('lowercases and strips whitespace from a plain name', () => {
    expect(generateUsername('Juan Dela Cruz', [])).toBe('juandelacruz');
  });

  it('preserves digits already present in the name', () => {
    expect(generateUsername('Jerico 1', [])).toBe('jerico1');
    expect(generateUsername('Jerico 2', [])).toBe('jerico2');
  });

  it('appends a numeric suffix on collision with an existing username', () => {
    expect(generateUsername('Jerico', ['jerico'])).toBe('jerico2');
  });

  it('keeps incrementing the suffix past multiple collisions', () => {
    expect(generateUsername('Jerico', ['jerico', 'jerico2'])).toBe('jerico3');
  });
});
