import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import HomePage from '@/app/page';
import { useAuth } from '@/contexts/auth-context';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));

describe('HomePage', () => {
  beforeEach(() => vi.clearAllMocks());

  test('does not redirect while auth is still loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: true });
    render(<HomePage />);
    expect(replace).not.toHaveBeenCalled();
  });

  test('redirects to /login when not authenticated', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false });
    render(<HomePage />);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  test('redirects an authenticated admin to /products', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    render(<HomePage />);
    expect(replace).toHaveBeenCalledWith('/products');
  });

  test('redirects an authenticated customer to /my-ledger', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 3, username: 'juan1', role: 'customer', personId: 1 },
      isLoading: false,
    });
    render(<HomePage />);
    expect(replace).toHaveBeenCalledWith('/my-ledger');
  });
});
