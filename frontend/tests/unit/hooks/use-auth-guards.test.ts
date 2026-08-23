import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRequireAuth, useRedirectIfAuthenticated, useRequireRole } from '@/hooks/use-auth-guards';
import { useAuth } from '@/contexts/auth-context';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('useRequireAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  test('does not redirect while auth is still loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: true });
    renderHook(() => useRequireAuth());
    expect(replace).not.toHaveBeenCalled();
  });

  test('redirects to /login once loading settles with no user', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false });
    renderHook(() => useRequireAuth());
    expect(replace).toHaveBeenCalledWith('/login');
  });

  test('does not redirect once loading settles with a user present', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    renderHook(() => useRequireAuth());
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => vi.clearAllMocks());

  test('does not redirect while auth is still loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: true });
    renderHook(() => useRedirectIfAuthenticated());
    expect(replace).not.toHaveBeenCalled();
  });

  test('does not redirect once loading settles with no user', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false });
    renderHook(() => useRedirectIfAuthenticated());
    expect(replace).not.toHaveBeenCalled();
  });

  test('redirects an already-authenticated admin to /products', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    renderHook(() => useRedirectIfAuthenticated());
    expect(replace).toHaveBeenCalledWith('/products');
  });

  test('redirects an already-authenticated customer to /my-ledger', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 3, username: 'juan1', role: 'customer', personId: 1 },
      isLoading: false,
    });
    renderHook(() => useRedirectIfAuthenticated());
    expect(replace).toHaveBeenCalledWith('/my-ledger');
  });
});

describe('useRequireRole', () => {
  beforeEach(() => vi.clearAllMocks());

  test('does not redirect while auth is still loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: true });
    renderHook(() => useRequireRole(['admin', 'store_owner']));
    expect(replace).not.toHaveBeenCalled();
  });

  test('does not redirect once loading settles with no user (useRequireAuth handles that case)', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false });
    renderHook(() => useRequireRole(['admin', 'store_owner']));
    expect(replace).not.toHaveBeenCalled();
  });

  test('does not redirect when the user has an allowed role', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    renderHook(() => useRequireRole(['admin', 'store_owner']));
    expect(replace).not.toHaveBeenCalled();
  });

  test('redirects a customer with a disallowed role to their own landing path', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 3, username: 'juan1', role: 'customer', personId: 1 },
      isLoading: false,
    });
    renderHook(() => useRequireRole(['admin', 'store_owner']));
    expect(replace).toHaveBeenCalledWith('/my-ledger');
  });
});
