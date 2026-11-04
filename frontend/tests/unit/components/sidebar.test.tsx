import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { usePathname } from 'next/navigation';

vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

const adminUser = { id: 1, username: 'admin', role: 'admin' as const, personId: null };
const customerUser = { id: 3, username: 'juan1', role: 'customer' as const, personId: 1 };

describe('Sidebar', () => {
  const logout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/products');
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: adminUser, logout });
  });

  test('shows the full operational nav for an admin', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Store Prices' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Loans' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Ledger' })).not.toBeInTheDocument();
  });

  test('shows only the customer nav for a customer', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: customerUser, logout });
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'My Ledger' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/catalog');
    expect(screen.queryByRole('link', { name: 'Loans' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Accounts' })).not.toBeInTheDocument();
  });

  test('marks the nav item matching the current pathname as active', () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/loans');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Loans' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Products' })).not.toHaveAttribute('aria-current');
  });

  test('shows the profile link with the current user and role', () => {
    render(<Sidebar />);
    const profileLink = screen.getByRole('link', { name: /admin/i });
    expect(profileLink).toHaveAttribute('href', '/profile');
  });

  test('logout button calls logout()', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /log ?out/i }));
    expect(logout).toHaveBeenCalled();
  });

  test('expanded by default: nav labels and profile name/role text are visible', () => {
    render(<Sidebar />);
    expect(screen.getByText('Products')).toBeInTheDocument();
    // Username and role are both literally "admin" in this fixture, so both render.
    expect(screen.getAllByText('admin')).toHaveLength(2);
  });

  test('collapsing hides nav labels and the profile name/role text, but links remain reachable', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /collapse/i }));

    expect(screen.queryByText('Products')).not.toBeInTheDocument();
    expect(screen.queryAllByText('admin')).toHaveLength(0);
    // The link itself is still there and still labeled for accessibility —
    // only the visible text label goes away, matching the mockup's fix.
    expect(screen.getByRole('link', { name: 'Products' })).toBeInTheDocument();
  });

  test('collapsing centers the nav icons instead of leaving them left-aligned (regression: mockup review bug)', () => {
    render(<Sidebar />);
    const expandedWrap = screen.getByTestId('nav-item-content-Products');
    expect(expandedWrap.className).not.toContain('justify-center');

    fireEvent.click(screen.getByRole('button', { name: /collapse/i }));

    const collapsedWrap = screen.getByTestId('nav-item-content-Products');
    expect(collapsedWrap.className).toContain('justify-center');
  });

  test('collapsing centers the header logo (regression: mockup review bug)', () => {
    render(<Sidebar />);
    const expandedHeader = screen.getByTestId('sidebar-header');
    expect(expandedHeader.className).not.toContain('justify-center');

    fireEvent.click(screen.getByRole('button', { name: /collapse/i }));

    const collapsedHeader = screen.getByTestId('sidebar-header');
    expect(collapsedHeader.className).toContain('justify-center');
  });

  test('collapsing centers the footer avatar (regression: mockup review bug)', () => {
    render(<Sidebar />);
    const expandedFooter = screen.getByTestId('sidebar-footer');
    expect(expandedFooter.className).not.toContain('justify-center');

    fireEvent.click(screen.getByRole('button', { name: /collapse/i }));

    const collapsedFooter = screen.getByTestId('sidebar-footer');
    expect(collapsedFooter.className).toContain('justify-center');
  });

  test('expanding after collapsing restores the labels', () => {
    render(<Sidebar />);
    const toggle = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(toggle);
    expect(screen.queryByText('Products')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Products')).toBeInTheDocument();
  });
});
