import { hasNul, INT_MAX, isPlainObject, isPositiveInteger, NUL_MESSAGE } from '../../shared/validation.js';

export const MAX_STORE_NAME_LENGTH = 100;

// Control characters, and characters that hide or spoof a name: soft hyphen, zero-width space, line
// and paragraph separators, word joiner and invisible math operators, deprecated format characters,
// the byte order mark, bidi embeddings/overrides/isolates (they reorder what is displayed), the
// blank-rendering Mongolian vowel separator, combining grapheme joiner, Hangul fillers, braille
// blank, the object replacement character, and the tag block. Joiners (U+200C, U+200D) and direction
// marks (U+200E, U+200F) stay allowed: real writing systems and emoji sequences need them.
const HIDING_CHARACTERS =
  /[\p{Cc}\u00AD\u034F\u180E\u200B\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u206F\u2800\u3164\uFEFF\uFFA0\uFFFC\u{E0000}-\u{E007F}]/u;

export interface StoreNameBody {
  name?: string;
}

export interface MergeStoreBody {
  into?: number;
}

// Also used for the store name on a store price. Length is measured after
// trimming, because the trimmed name is what is stored (the stores table
// rejects a padded, blank or over-long name outright).
export function validateStoreName(name: unknown): string | null {
  if (typeof name !== 'string') return 'name must be text';
  const trimmed = name.trim();
  if (trimmed === '') return 'The store name cannot be blank';
  if (trimmed.length > MAX_STORE_NAME_LENGTH) return `The store name can be at most ${MAX_STORE_NAME_LENGTH} characters`;
  if (hasNul(trimmed)) return NUL_MESSAGE;
  // Control characters and the invisible ones that only hide things: a zero-width space, a word
  // joiner, a soft hyphen, a byte order mark, line and paragraph separators. A name of only these
  // looks blank but is not, and two stores differing by one would look identical in the list.
  // Joiners and direction marks (U+200C, U+200D, U+200E, U+200F) stay allowed: real writing
  // systems and emoji sequences need them.
  if (HIDING_CHARACTERS.test(trimmed)) {
    return 'The store name cannot contain control or invisible characters';
  }
  // A name of only joiners, direction marks and spaces passes the checks above but looks blank.
  if (!/[^\s\u200C-\u200F]/u.test(trimmed)) return 'The store name must contain a visible character';
  return null;
}

export function validateCreateStore(body: StoreNameBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  return validateStoreName(body.name);
}

export const validateRenameStore = validateCreateStore;

export function validateMergeStore(body: MergeStoreBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (!isPositiveInteger(body.into) || (body.into as number) > INT_MAX) {
    return 'into must be the id of the store to merge into';
  }
  return null;
}
