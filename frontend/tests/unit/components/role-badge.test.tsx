import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleBadge } from '@/components/role-badge';

describe('RoleBadge', () => {
  test.each([
    ['admin', 'Admin', 'bg-text'],
    ['store_owner', 'Store owner', 'bg-accent'],
    ['customer', 'Customer', 'border'],
  ] as const)('%s renders "%s" in its own palette (admin dark, store owner teal, customer neutral)', (role, label, cls) => {
    render(<RoleBadge role={role} />);
    expect(screen.getByText(label).className).toContain(cls);
  });
});
