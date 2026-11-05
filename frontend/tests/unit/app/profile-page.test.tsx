import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import ProfilePage from '@/app/(app)/profile/page';
import { useAuth } from '@/contexts/auth-context';
import { changePassword, changeUsername } from '@/lib/profile-client';
import { ApiError } from '@/lib/api-client';
import type { Role } from '@/lib/auth-types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/profile-client', () => ({ changeUsername: vi.fn(), changePassword: vi.fn() }));

const refreshUser = vi.fn();
const logout = vi.fn();

function signInAs(role: Role, username = 'owner1') {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 5, username, role, personId: role === 'customer' ? 2 : null },
    isLoading: false,
    refreshUser,
    logout,
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TopbarProvider>
        <Topbar />
        <ProfilePage />
      </TopbarProvider>
    </QueryClientProvider>
  );
  return { queryClient };
}

const usernameInput = () => screen.getByLabelText(/^username$/i);
const currentInput = () => screen.getByLabelText(/current password/i);
const newInput = () => screen.getByLabelText(/new password/i);
const saveUsername = () => screen.getByRole('button', { name: /save username/i });
const savePassword = () => screen.getByRole('button', { name: /save password/i });

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshUser.mockResolvedValue(undefined);
    signInAs('store_owner');
  });

  test.each<Role>(['admin', 'store_owner', 'customer'])('is available to a %s, showing who they are', (role) => {
    signInAs(role, 'someone');
    renderPage();
    expect(screen.getByRole('heading', { name: 'someone' })).toBeInTheDocument();
    expect(screen.getByText(role === 'store_owner' ? 'Store owner' : role === 'admin' ? 'Admin' : 'Customer')).toBeInTheDocument();
    expect(usernameInput()).toHaveValue('someone');
  });

  describe('changing the username', () => {
    test('does nothing while the username is unchanged', () => {
      renderPage();
      expect(saveUsername()).toBeDisabled();
    });

    test('rejects a blank username before calling the backend', () => {
      renderPage();
      fireEvent.change(usernameInput(), { target: { value: '   ' } });
      fireEvent.click(saveUsername());
      expect(screen.getByRole('alert')).toHaveTextContent(/username is required/i);
      expect(changeUsername).not.toHaveBeenCalled();
    });

    test('rejects a username over 50 characters before calling the backend', () => {
      renderPage();
      fireEvent.change(usernameInput(), { target: { value: 'x'.repeat(51) } });
      fireEvent.click(saveUsername());
      expect(screen.getByRole('alert')).toHaveTextContent(/at most 50 characters/i);
      expect(changeUsername).not.toHaveBeenCalled();
    });

    test('sends the trimmed username, refreshes the signed-in user and confirms', async () => {
      (changeUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      renderPage();
      fireEvent.change(usernameInput(), { target: { value: '  maria2  ' } });
      fireEvent.click(saveUsername());

      await waitFor(() => expect(changeUsername).toHaveBeenCalledWith('maria2'));
      await waitFor(() => expect(refreshUser).toHaveBeenCalled());
      expect(await screen.findByRole('status')).toHaveTextContent(/username updated/i);
    });

    test("shows the backend's conflict error when the username is taken, and does not refresh", async () => {
      (changeUsername as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(409, { error: 'That username is already taken' })
      );
      renderPage();
      fireEvent.change(usernameInput(), { target: { value: 'taken' } });
      fireEvent.click(saveUsername());

      expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken');
      expect(refreshUser).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(usernameInput()).toHaveValue('taken');
    });

    test('locks the button while saving', async () => {
      (changeUsername as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      fireEvent.change(usernameInput(), { target: { value: 'maria2' } });
      fireEvent.click(saveUsername());
      expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  describe('changing the password', () => {
    test('requires both fields', () => {
      renderPage();
      fireEvent.click(savePassword());
      expect(screen.getByRole('alert')).toHaveTextContent(/enter your current password and a new one/i);
      expect(changePassword).not.toHaveBeenCalled();
    });

    test.each(['short1', 'x'.repeat(17)])('rejects a new password of the wrong length (%s) before calling the backend', (value) => {
      renderPage();
      fireEvent.change(currentInput(), { target: { value: 'old-password' } });
      fireEvent.change(newInput(), { target: { value } });
      fireEvent.click(savePassword());
      expect(screen.getByRole('alert')).toHaveTextContent(/between 8 and 16 characters/i);
      expect(changePassword).not.toHaveBeenCalled();
    });

    test('keeps the password fields masked and out of autofill guesses', () => {
      renderPage();
      expect(currentInput()).toHaveAttribute('type', 'password');
      expect(currentInput()).toHaveAttribute('autocomplete', 'current-password');
      expect(newInput()).toHaveAttribute('type', 'password');
      expect(newInput()).toHaveAttribute('autocomplete', 'new-password');
    });

    test('saves, confirms, clears both fields, and keeps the user signed in', async () => {
      (changePassword as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      renderPage();
      fireEvent.change(currentInput(), { target: { value: 'old-password' } });
      fireEvent.change(newInput(), { target: { value: 'brand-new-pass' } });
      fireEvent.click(savePassword());

      await waitFor(() => expect(changePassword).toHaveBeenCalledWith('old-password', 'brand-new-pass'));
      expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
      expect(currentInput()).toHaveValue('');
      expect(newInput()).toHaveValue('');
      expect(logout).not.toHaveBeenCalled();
    });

    test('a wrong current password shows the error, does NOT sign the user out, and keeps what was typed', async () => {
      (changePassword as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(401, { error: 'Current password is incorrect' })
      );
      renderPage();
      fireEvent.change(currentInput(), { target: { value: 'wrong-guess' } });
      fireEvent.change(newInput(), { target: { value: 'brand-new-pass' } });
      fireEvent.click(savePassword());

      expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
      expect(logout).not.toHaveBeenCalled();
      expect(newInput()).toHaveValue('brand-new-pass');
      expect(screen.queryByText(/password updated/i)).not.toBeInTheDocument();
    });

    test('does not leave either password in the mutation cache after a successful change', async () => {
      (changePassword as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const { queryClient } = renderPage();
      fireEvent.change(currentInput(), { target: { value: 'old-password' } });
      fireEvent.change(newInput(), { target: { value: 'brand-new-pass' } });
      fireEvent.click(savePassword());
      await screen.findByText(/password updated/i);

      await waitFor(() => {
        const cached = queryClient.getMutationCache().getAll().map((m) => JSON.stringify(m.state.variables ?? null));
        expect(cached.join('')).not.toContain('old-password');
        expect(cached.join('')).not.toContain('brand-new-pass');
      });
    });

    test('a username error and a password error do not overwrite each other', async () => {
      (changeUsername as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'That username is already taken' }));
      (changePassword as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(401, { error: 'Current password is incorrect' }));
      renderPage();
      fireEvent.change(usernameInput(), { target: { value: 'taken' } });
      fireEvent.click(saveUsername());
      await screen.findByText('That username is already taken');
      fireEvent.change(currentInput(), { target: { value: 'wrong-guess' } });
      fireEvent.change(newInput(), { target: { value: 'brand-new-pass' } });
      fireEvent.click(savePassword());

      expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
      expect(screen.getByText('That username is already taken')).toBeInTheDocument();
    });
  });
});
