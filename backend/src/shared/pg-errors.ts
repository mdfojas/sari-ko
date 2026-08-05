const FOREIGN_KEY_VIOLATION = '23503';

export function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === FOREIGN_KEY_VIOLATION;
}
