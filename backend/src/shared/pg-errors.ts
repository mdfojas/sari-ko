const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === FOREIGN_KEY_VIOLATION;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

// SQLSTATE "data exception" codes that mean the caller's input was unacceptable
// to Postgres: string too long, numeric / datetime out of range or malformed, a
// NUL byte in text, an invalid text representation. A deliberate allowlist, not
// the whole class 22 (or class 2x): constraint violations and server faults
// must keep their own handling, not be reported as the caller's mistake.
const BAD_INPUT_CODES = new Set(['22001', '22003', '22007', '22008', '22021', '22P02']);

export function isDataException(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  return typeof code === 'string' && BAD_INPUT_CODES.has(code);
}

// 40001 serialization failure and 40P01 deadlock: the database aborted this transaction because
// of a concurrent one. Nothing was changed, and trying again is the right response.
export function isRetryableConflict(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  return code === '40001' || code === '40P01';
}
