import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api-client';

vi.mock('@/hooks/use-auth-guards', () => ({ useRedirectIfAuthenticated: vi.fn() }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));

describe('LoginPage', () => {
  const login = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ login, user: null, isLoading: false });
  });

  test('submits the entered username and password', async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'juan1' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('juan1', 'secret123'));
  });

  test('shows a generic "invalid credentials" message for a real auth failure (401)', async () => {
    login.mockRejectedValue(new ApiError(401, { error: 'Invalid username or password' }));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'juan1' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid username or password/i)
    );
  });

  test('shows a distinct message for a non-auth failure (network/server error), not the credentials message', async () => {
    login.mockRejectedValue(new Error('Request timed out after 120000ms'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'juan1' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).not.toHaveTextContent(/invalid username or password/i);
      expect(alert).toHaveTextContent(/something went wrong/i);
    });
  });

  test('disables the submit button while the login request is in flight', async () => {
    let resolveLogin: () => void = () => {};
    login.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      })
    );
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'juan1' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    resolveLogin();
  });

  test('does not render the form while auth is still loading', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ login, user: null, isLoading: true });
    render(<LoginPage />);
    expect(screen.queryByRole('button', { name: /log in/i })).not.toBeInTheDocument();
  });

  test('does not render the form when already authenticated (redirect in flight)', () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      login,
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    render(<LoginPage />);
    expect(screen.queryByRole('button', { name: /log in/i })).not.toBeInTheDocument();
  });
});
