import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from '@/app/(app)/layout';
import { useAuth } from '@/contexts/auth-context';

vi.mock('@/hooks/use-auth-guards', () => ({ useRequireAuth: vi.fn() }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));

describe('ProtectedLayout', () => {
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
});
