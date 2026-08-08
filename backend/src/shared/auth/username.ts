export function generateUsername(name: string, existingUsernames: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const existing = new Set(existingUsernames);

  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}${suffix}`)) suffix++;
  return `${base}${suffix}`;
}
