import type { Role } from './auth-types';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const OPERATIONAL_NAV: NavItem[] = [
  { label: 'Products', href: '/products', icon: '📦' },
  { label: 'Store Prices', href: '/store-prices', icon: '🏷️' },
  { label: 'Loans', href: '/loans', icon: '📒' },
  { label: 'Accounts', href: '/accounts', icon: '👤' },
];

const CUSTOMER_NAV: NavItem[] = [
  { label: 'My Ledger', href: '/my-ledger', icon: '📒' },
  { label: 'Products', href: '/catalog', icon: '📦' },
];

export function navItemsForRole(role: Role): NavItem[] {
  return role === 'customer' ? CUSTOMER_NAV : OPERATIONAL_NAV;
}
