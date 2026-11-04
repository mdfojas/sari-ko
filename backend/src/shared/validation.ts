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
