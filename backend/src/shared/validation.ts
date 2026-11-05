// Shared request-validation helpers and the limits of the database's types.
// Money is stored as whole centavos in 32-bit INTEGER columns, so anything
// that isn't an integer, or is outside that range, would only fail later as an
// unhandled database error — or worse, be saved and then break a SUM(...)::integer
// somewhere else. Validators use these to reject it up front with a message.

export const INT_MAX = 2_147_483_647; // PostgreSQL INTEGER ceiling, in centavos
export const MAX_AMOUNT_TEXT = '₱21,474,836.47';

// Postgres refuses a NUL byte in text (error 22021), which would surface as a 500.
export const NUL_MESSAGE = 'Text cannot contain NUL characters';

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Whether it is a positive whole number; its range (<= INT_MAX) is checked separately.
export const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

export const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

export const hasNul = (value: unknown): boolean => typeof value === 'string' && value.includes('\u0000');

export const MAX_USERNAME_LENGTH = 50;

// Shared by every route that takes a username (self-service change, account
// creation). Length is measured after trimming, because the trimmed value is
// what gets stored.
export function validateUsername(value: unknown): string | null {
  if (typeof value !== 'string') return 'username must be text';
  const trimmed = value.trim();
  if (trimmed === '') return 'username cannot be blank';
  if (trimmed.length > MAX_USERNAME_LENGTH) return `username can be at most ${MAX_USERNAME_LENGTH} characters`;
  if (hasNul(trimmed)) return NUL_MESSAGE;
  return null;
}
