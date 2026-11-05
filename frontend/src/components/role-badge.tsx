import type { Role } from '@/lib/auth-types';

const BADGES: Record<Role, { label: string; className: string }> = {
  admin: { label: 'Admin', className: 'bg-text text-white' },
  store_owner: { label: 'Store owner', className: 'bg-accent text-white' },
  customer: { label: 'Customer', className: 'border border-border text-text-muted' },
};

// Palette from the finalized mockup: admin solid dark, store owner teal,
// customer neutral.
export function RoleBadge({ role }: { role: Role }) {
  const { label, className } = BADGES[role];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${className}`}>{label}</span>;
}
