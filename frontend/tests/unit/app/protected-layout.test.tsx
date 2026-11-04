import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from '@/app/(app)/layout';
import { useAuth } from '@/contexts/auth-context';
import { useRouteAccess } from '@/hooks/use-auth-guards';

vi.mock('@/hooks/use-auth-guards', () => ({ useRequireAuth: vi.fn(), useRouteAccess: vi.fn() }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/sidebar', () => ({ Sidebar: () => <div data-testid="sidebar-stub" /> }));
vi.mock('@/components/topbar', () => ({ Topbar: () => <div data-testid="topbar-stub" /> }));

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouteAccess as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  test('does not render children when the current route is not allowed for this role, even though they are signed in', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 3, username: 'juan', role: 'customer', personId: 1 },
      isLoading: false,
    });
    (useRouteAccess as ReturnType<typeof vi.fn>).mockReturnValue(false);
    render(
      <ProtectedLayout>
        <div data-testid="child" />
      </ProtectedLayout>
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-stub')).not.toBeInTheDocument();
  });

  test('does not render children while auth is still loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: true });
    render(
      <ProtectedLayout>
        <div data-testid="child" />
      </ProtectedLayout>
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  test('does not render children once loading settles with no user (redirect in flight)', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false });
    render(
      <ProtectedLayout>
        <div data-testid="child" />
      </ProtectedLayout>
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  test('renders children once authenticated', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    render(
      <ProtectedLayout>
        <div data-testid="child" />
      </ProtectedLayout>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  test('renders the sidebar and topbar chrome around the children once authenticated', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    render(
      <ProtectedLayout>
        <div data-testid="child" />
      </ProtectedLayout>
    );
    expect(screen.getByTestId('sidebar-stub')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-stub')).toBeInTheDocument();
  });
});
