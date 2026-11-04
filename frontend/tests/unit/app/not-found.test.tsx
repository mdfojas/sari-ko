import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';
import { useAuth } from '@/contexts/auth-context';

vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));

const logout = vi.fn();

describe('NotFound', () => {
  beforeEach(() => vi.clearAllMocks());

  test('shows a not-found message', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false, logout });
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  test('offers a log out button to a signed-in user, so a 404 is never a dead end', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 3, username: 'juandelacruz', role: 'customer', personId: 1 },
      isLoading: false,
      logout,
    });
    render(<NotFound />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(logout).toHaveBeenCalledOnce();
  });

  test('does not show a log out button when nobody is signed in', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ user: null, isLoading: false, logout });
    render(<NotFound />);
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });
});
