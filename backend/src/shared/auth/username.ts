const FALLBACK_BASE = 'customer';

export function generateUsername(name: string, existingUsernames: string[]): string {
  const stripped = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = stripped || FALLBACK_BASE;
  const existing = new Set(existingUsernames);

  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}${suffix}`)) suffix++;
  return `${base}${suffix}`;
}
