// Who is looking at a loan. 'staff' (admin / store_owner) reads the
// /persons and /loans endpoints and can edit; 'me' (a customer) reads the
// ownership-checked /me endpoints and is strictly read-only.
export type LoanScope = 'staff' | 'me';

// Customer data is cached under a separate "me" prefix so it can never share
// a cache entry with the staff views.
export function scopedKey(scope: LoanScope, ...key: (string | number)[]): (string | number)[] {
  return scope === 'me' ? ['me', ...key] : key;
}
