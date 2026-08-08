const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === FOREIGN_KEY_VIOLATION;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}
