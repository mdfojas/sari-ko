import { describe, expect, it } from 'vitest';
import {
  MAX_STORE_NAME_LENGTH,
  validateCreateStore,
  validateMergeStore,
  validateRenameStore,
  validateStoreName,
} from '../../../../src/routes/stores/validation.js';

describe('validateStoreName', () => {
  it.each(['Puregold', 'S&R', '7-Eleven', '  padded  ', 'x'.repeat(100)])('accepts %j', (name) => {
    expect(validateStoreName(name)).toBeNull();
  });

  it.each([undefined, null, 123, {}, [], true])('rejects a non-text name (%j)', (name) => {
    expect(validateStoreName(name)).toBe('name must be text');
  });

  it.each(['', '   ', '\t\n'])('rejects a blank name (%j)', (name) => {
    expect(validateStoreName(name)).toBe('The store name cannot be blank');
  });

  it('rejects a name over the length limit, measured after trimming', () => {
    expect(MAX_STORE_NAME_LENGTH).toBe(100);
    expect(validateStoreName('x'.repeat(101))).toBe('The store name can be at most 100 characters');
    expect(validateStoreName(` ${'x'.repeat(100)} `)).toBeNull();
  });

  it('rejects a NUL byte', () => {
    expect(validateStoreName('a\u0000b')).toBe('Text cannot contain NUL characters');
  });

  // A name made only of invisible characters looks blank but is not, and two stores that
  // differ only by an invisible character would look identical in the list.
  it.each(['\u200B', 'Pure\u200Bgold', '\u2060x', 'x\u00ADy', 'a\tb', 'a\nb'])('rejects control or invisible characters (%j)', (name) => {
    expect(validateStoreName(name)).toBe('The store name cannot contain control or invisible characters');
  });

  // Characters that spoof or hide a name: bidi overrides/embeddings/isolates reorder what is shown,
  // invisible operators and fillers render as nothing.
  it.each([
    'A\u202EB', 'A\u202AB', 'A\u202DB', 'A\u2066B', 'A\u2069B',
    'A\u2061B', 'A\u2064B', 'A\u206AB', 'A\u206FB',
    'A\u180EB', 'A\u034FB', 'A\u3164B', 'A\uFFA0B', 'A\u2800B', 'A\uFFFCB',
    'A\u{E0041}B', 'A\u{E007F}B',
  ])('rejects spoofing or invisible characters (%j)', (name) => {
    expect(validateStoreName(name)).toBe('The store name cannot contain control or invisible characters');
  });

  // A name made only of joiners, direction marks and spaces looks blank.
  it.each(['\u200C', '\u200D', '\u200E\u200F', ' \u200D \u200C ', '\u200F\u200E\u200D'])('rejects a name with no visible character (%j)', (name) => {
    expect(validateStoreName(name)).toBe('The store name must contain a visible character');
  });

  // Joiners and direction marks are needed by real writing systems and by emoji sequences.
  it.each(['\u{1F468}\u200D\u{1F469}\u200D\u{1F467} Family Mart', 'Ma\u200Cn', '\u200Fمتجر\u200F', 'क्\u200Dष'])('accepts a name that needs a joiner or direction mark (%j)', (name) => {
    expect(validateStoreName(name)).toBeNull();
  });

  it('still accepts ordinary punctuation, accents and non-Latin names', () => {
    for (const name of ["Mang Tomas' Store", 'Café Ñandú', "7-Eleven (SM North)", 'S&R', '百货']) {
      expect(validateStoreName(name)).toBeNull();
    }
  });
});

describe.each([
  ['validateCreateStore', validateCreateStore],
  ['validateRenameStore', validateRenameStore],
])('%s', (_name, validate) => {
  const check = (body: unknown) => validate(body as never);

  it('accepts a body with a valid name', () => {
    expect(check({ name: 'Puregold' })).toBeNull();
  });

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%j)', (body) => {
    expect(check(body)).toBe('Request body must be a JSON object');
  });

  it('applies the name rules', () => {
    expect(check({})).toBe('name must be text');
    expect(check({ name: '  ' })).toBe('The store name cannot be blank');
    expect(check({ name: 'x'.repeat(101) })).toBe('The store name can be at most 100 characters');
  });
});

describe('validateMergeStore', () => {
  const check = (body: unknown) => validateMergeStore(body as never);

  it('accepts a positive whole store id', () => {
    expect(check({ into: 3 })).toBeNull();
    expect(check({ into: 2_147_483_647 })).toBeNull();
  });

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%j)', (body) => {
    expect(check(body)).toBe('Request body must be a JSON object');
  });

  it.each([undefined, null, '3', 0, -1, 1.5, 2_147_483_648, {}])('rejects the target %j', (into) => {
    expect(check({ into })).toBe('into must be the id of the store to merge into');
  });
});
