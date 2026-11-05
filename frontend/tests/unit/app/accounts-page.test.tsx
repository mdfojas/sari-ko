import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import AccountsPage from '@/app/(app)/accounts/page';
import { useAuth } from '@/contexts/auth-context';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  type Account,
} from '@/lib/accounts-client';
import { listPersons, type Person } from '@/lib/persons-client';
import { ApiError } from '@/lib/api-client';
import type { Role } from '@/lib/auth-types';

const replace = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/accounts-client', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  deleteAccount: vi.fn(),
  resetAccountPassword: vi.fn(),
}));
vi.mock('@/lib/persons-client', () => ({ listPersons: vi.fn() }));

const account = (id: number, username: string, role: Role, person_id: number | null = null): Account => ({
  id,
  username,
  role,
  person_id,
  created_at: '2026-03-15T12:00:00.000Z',
  updated_at: '2026-03-15T12:00:00.000Z',
});

const admin = account(1, 'admin', 'admin');
const storeOwner = account(2, 'storeowner', 'store_owner');
const customer = account(3, 'juandelacruz', 'customer', 1);

const persons: Person[] = [
  { id: 1, name: 'Juan Dela Cruz', contact: null, has_account: true, balance: 0, created_at: '', updated_at: '' },
  { id: 2, name: 'Maria Santos', contact: null, has_account: false, balance: 0, created_at: '', updated_at: '' },
];

function signInAs(role: Role) {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 99, username: 'me', role, personId: null },
    isLoading: false,
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <TopbarProvider>
        <Topbar />
        <AccountsPage />
      </TopbarProvider>
    </QueryClientProvider>
  );
  return { invalidate, queryClient };
}

async function openProfile(username: string) {
  fireEvent.click(await screen.findByRole('button', { name: username }));
  return screen.findByRole('dialog', { name: `Account: ${username}` });
}

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs('admin');
    (listAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([admin, storeOwner, customer]);
    (listPersons as ReturnType<typeof vi.fn>).mockResolvedValue(persons);
  });

  describe('access', () => {
    test('redirects a customer away and renders nothing', async () => {
      signInAs('customer');
      renderPage();
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/my-ledger'));
      expect(screen.queryByLabelText(/search accounts/i)).not.toBeInTheDocument();
    });
  });

  describe('listing', () => {
    test('shows every account with its role badge and, for customers, the linked person', async () => {
      renderPage();
      expect(await screen.findByRole('button', { name: 'admin' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'storeowner' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'juandelacruz' })).toBeInTheDocument();
      const row = screen.getByRole('button', { name: 'juandelacruz' }).closest('tr') as HTMLElement;
      expect(within(row).getByText('Customer')).toBeInTheDocument();
      expect(within(row).getByText('Juan Dela Cruz')).toBeInTheDocument();
    });

    test('filters by username as you type', async () => {
      renderPage();
      await screen.findByRole('button', { name: 'admin' });
      fireEvent.change(screen.getByLabelText(/search accounts/i), { target: { value: 'JUAN' } });
      expect(screen.getByRole('button', { name: 'juandelacruz' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'admin' })).not.toBeInTheDocument();
    });

    test('says so when nothing matches the search', async () => {
      renderPage();
      await screen.findByRole('button', { name: 'admin' });
      fireEvent.change(screen.getByLabelText(/search accounts/i), { target: { value: 'zzz' } });
      expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();
    });

    test('a failing load shows the error, not an empty table', async () => {
      (listAccounts as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
      renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('db down');
      expect(screen.queryByText(/no accounts/i)).not.toBeInTheDocument();
    });
  });

  describe('when the people list fails to load', () => {
    test('the table says linked names are unavailable instead of silently showing dashes', async () => {
      (listPersons as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent(/linked person names are unavailable.*boom/i);
      expect(screen.getByText('juandelacruz')).toBeInTheDocument();
    });
  });

  describe('permissions in the profile popup', () => {
    test('an admin can reset and delete every account', async () => {
      renderPage();
      for (const name of ['admin', 'storeowner', 'juandelacruz']) {
        const dialog = await openProfile(name);
        expect(within(dialog).getByRole('button', { name: /reset password/i })).toBeEnabled();
        expect(within(dialog).getByRole('button', { name: /delete account/i })).toBeEnabled();
        fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
      }
    });

    test('a store_owner can manage customers, but Reset/Delete are disabled with a tooltip on admin and store_owner rows', async () => {
      signInAs('store_owner');
      renderPage();

      for (const name of ['admin', 'storeowner']) {
        const dialog = await openProfile(name);
        expect(within(dialog).getByRole('button', { name: /reset password/i })).toBeDisabled();
        const del = within(dialog).getByRole('button', { name: /delete account/i });
        expect(del).toBeDisabled();
        expect(del).toHaveAttribute('title');
        fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
      }

      const customerDialog = await openProfile('juandelacruz');
      expect(within(customerDialog).getByRole('button', { name: /reset password/i })).toBeEnabled();
      expect(within(customerDialog).getByRole('button', { name: /delete account/i })).toBeEnabled();
    });
  });

  describe('resetting a password', () => {
    async function startReset() {
      const dialog = await openProfile('juandelacruz');
      fireEvent.click(within(dialog).getByRole('button', { name: /reset password/i }));
      return screen.findByRole('dialog', { name: /reset password/i });
    }

    test('auto-generates when left blank and shows the new credential exactly once', async () => {
      (resetAccountPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ password: 'Generated99' });
      renderPage();
      const resetDialog = await startReset();
      fireEvent.click(within(resetDialog).getByRole('button', { name: /^reset password$/i }));

      await waitFor(() => expect(resetAccountPassword).toHaveBeenCalledWith(3, undefined));
      const result = await screen.findByRole('dialog', { name: /password reset/i });
      expect(within(result).getByText('Generated99')).toBeInTheDocument();
      expect(within(result).getByRole('button', { name: /copy password/i })).toBeInTheDocument();

      fireEvent.click(within(result).getByRole('button', { name: /done/i }));
      expect(screen.queryByText('Generated99')).not.toBeInTheDocument();
    });

    test('does not leave the generated password in the mutation cache after Done', async () => {
      (resetAccountPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ password: 'Generated99' });
      const { queryClient } = renderPage();
      const resetDialog = await startReset();
      fireEvent.click(within(resetDialog).getByRole('button', { name: /^reset password$/i }));
      const result = await screen.findByRole('dialog', { name: /password reset/i });
      fireEvent.click(within(result).getByRole('button', { name: /done/i }));

      await waitFor(() => {
        const cached = queryClient.getMutationCache().getAll().map((m) => JSON.stringify(m.state.data ?? null));
        expect(cached.join('')).not.toContain('Generated99');
      });
    });

    test('sends an explicit password when one is typed', async () => {
      (resetAccountPassword as ReturnType<typeof vi.fn>).mockResolvedValue({ password: 'mypassword1' });
      renderPage();
      const resetDialog = await startReset();
      fireEvent.change(within(resetDialog).getByLabelText(/new password/i), { target: { value: 'mypassword1' } });
      fireEvent.click(within(resetDialog).getByRole('button', { name: /^reset password$/i }));
      await waitFor(() => expect(resetAccountPassword).toHaveBeenCalledWith(3, 'mypassword1'));
    });

    test('a failed reset with a typed password does not keep it in the mutation cache after Cancel', async () => {
      (resetAccountPassword as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(403, { error: 'Forbidden' }));
      const { queryClient } = renderPage();
      const resetDialog = await startReset();
      fireEvent.change(within(resetDialog).getByLabelText(/new password/i), { target: { value: 'typedsecret1' } });
      fireEvent.click(within(resetDialog).getByRole('button', { name: /^reset password$/i }));
      await within(resetDialog).findByRole('alert');
      fireEvent.click(within(resetDialog).getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        const cached = queryClient.getMutationCache().getAll().map((m) => JSON.stringify(m.state.variables ?? null));
        expect(cached.join('')).not.toContain('typedsecret1');
      });
    });

    test("keeps the form open and shows the server's error if the reset fails", async () => {
      (resetAccountPassword as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(403, { error: 'Forbidden' }));
      renderPage();
      const resetDialog = await startReset();
      fireEvent.click(within(resetDialog).getByRole('button', { name: /^reset password$/i }));
      expect(await within(resetDialog).findByRole('alert')).toHaveTextContent('Forbidden');
    });
  });

  describe('deleting an account', () => {
    test('asks for confirmation, then deletes and refreshes the accounts and people lists', async () => {
      (deleteAccount as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { invalidate } = renderPage();
      const dialog = await openProfile('juandelacruz');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete account/i }));

      const confirm = await screen.findByRole('dialog', { name: /delete this account/i });
      expect(within(confirm).getByText(/juandelacruz/)).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete account$/i }));

      await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(3));
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['accounts'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
      });
    });

    test('cancelling does not delete', async () => {
      renderPage();
      const dialog = await openProfile('juandelacruz');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete account/i }));
      const confirm = await screen.findByRole('dialog', { name: /delete this account/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /cancel/i }));
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    test('a failed delete shows the error inside the confirmation', async () => {
      (deleteAccount as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'Account not found' }));
      renderPage();
      const dialog = await openProfile('juandelacruz');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete account/i }));
      const confirm = await screen.findByRole('dialog', { name: /delete this account/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete account$/i }));
      expect(await within(confirm).findByRole('alert')).toHaveTextContent('Account not found');
    });

    test('the only admin cannot be deleted: a block message appears instead of a confirmation', async () => {
      renderPage();
      const dialog = await openProfile('admin');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete account/i }));

      expect(within(dialog).getByRole('alert')).toHaveTextContent(/only admin/i);
      expect(screen.queryByRole('dialog', { name: /delete this account/i })).not.toBeInTheDocument();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    test('an admin can be deleted when another admin exists', async () => {
      (listAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([admin, account(4, 'admin2', 'admin'), customer]);
      renderPage();
      const dialog = await openProfile('admin2');
      fireEvent.click(within(dialog).getByRole('button', { name: /delete account/i }));
      expect(await screen.findByRole('dialog', { name: /delete this account/i })).toBeInTheDocument();
    });
  });

  describe('creating an account', () => {
    async function openCreate() {
      await screen.findByRole('button', { name: 'admin' });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      return screen.findByRole('dialog', { name: /create account/i });
    }

    test('creates a customer for a person and shows the generated credentials once', async () => {
      (createAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...account(5, 'mariasantos', 'customer', 2),
        password: 'Gen3rated!!',
      });
      const { invalidate } = renderPage();
      const form = await openCreate();
      fireEvent.change(within(form).getByLabelText(/^person$/i), { target: { value: '2' } });
      fireEvent.click(within(form).getByRole('button', { name: /^create account$/i }));

      await waitFor(() => expect(createAccount).toHaveBeenCalledWith({ role: 'customer', person_id: 2 }));
      const result = await screen.findByRole('dialog', { name: /account created/i });
      expect(within(result).getByText('mariasantos')).toBeInTheDocument();
      expect(within(result).getByText('Gen3rated!!')).toBeInTheDocument();
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['accounts'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
      });
    });

    test('a duplicate username surfaces the backend conflict clearly, in the still-open form', async () => {
      (createAccount as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(409, { error: 'An account with this username already exists' })
      );
      renderPage();
      const form = await openCreate();
      fireEvent.change(within(form).getByLabelText(/^role$/i), { target: { value: 'store_owner' } });
      fireEvent.change(within(form).getByLabelText(/^username/i), { target: { value: 'admin' } });
      fireEvent.click(within(form).getByRole('button', { name: /^create account$/i }));

      expect(await within(form).findByRole('alert')).toHaveTextContent('An account with this username already exists');
      expect(screen.getByRole('dialog', { name: /create account/i })).toBeInTheDocument();
    });

    test('a failed create with a typed password does not keep it in the mutation cache after Cancel', async () => {
      (createAccount as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(409, { error: 'An account with this username already exists' })
      );
      const { queryClient } = renderPage();
      const form = await openCreate();
      fireEvent.change(within(form).getByLabelText(/^role$/i), { target: { value: 'store_owner' } });
      fireEvent.change(within(form).getByLabelText(/^username/i), { target: { value: 'admin' } });
      fireEvent.change(within(form).getByLabelText(/password/i), { target: { value: 'typedsecret1' } });
      fireEvent.click(within(form).getByRole('button', { name: /^create account$/i }));
      await within(form).findByRole('alert');
      fireEvent.click(within(form).getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        const cached = queryClient.getMutationCache().getAll().map((m) => JSON.stringify(m.state.variables ?? null));
        expect(cached.join('')).not.toContain('typedsecret1');
      });
    });

    test('a store_owner is only offered the customer role', async () => {
      signInAs('store_owner');
      renderPage();
      const form = await openCreate();
      const options = within(within(form).getByLabelText(/^role$/i)).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['Customer']);
    });

    test('does not claim everyone has an account when the people list failed to load', async () => {
      (listPersons as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      renderPage();
      const form = await openCreate();
      expect(within(form).queryByText(/every person already has an account/i)).not.toBeInTheDocument();
      expect(within(form).getByText(/couldn.t load the list of people/i)).toBeInTheDocument();
    });
  });
});
