import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import LoansPage from '@/app/(app)/loans/page';
import { useAuth } from '@/contexts/auth-context';
import { createAccount } from '@/lib/accounts-client';
import { createLoan } from '@/lib/loans-client';
import { createPayment } from '@/lib/payments-client';
import {
  createPerson,
  deletePerson,
  getLedger,
  listPersons,
  searchPersons,
  updatePerson,
  type Person,
} from '@/lib/persons-client';
import { ApiError } from '@/lib/api-client';
import type { Role } from '@/lib/auth-types';

const replace = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/persons-client', () => ({
  listPersons: vi.fn(),
  searchPersons: vi.fn(),
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  deletePerson: vi.fn(),
  getLedger: vi.fn(),
}));
vi.mock('@/lib/loans-client', () => ({ createLoan: vi.fn() }));
vi.mock('@/lib/payments-client', () => ({ createPayment: vi.fn() }));
vi.mock('@/lib/accounts-client', () => ({ createAccount: vi.fn() }));
// Tested on their own; stubbed so these tests stay about the page's orchestration.
vi.mock('@/components/person-ledger', () => ({
  PersonLedger: ({ personId }: { personId: number }) => <div data-testid="ledger">{`ledger of ${personId}`}</div>,
}));
vi.mock('@/components/loan-form-modal', () => ({
  LoanFormModal: ({ personName, onSave, onClose }: { personName: string; onSave: (i: unknown) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="New loan">
      <span>{`loan for ${personName}`}</span>
      <button onClick={() => onSave({ line_items: [{ description: 'rice', amount: 5800 }] })}>stub-save-loan</button>
      <button onClick={onClose}>stub-cancel-loan</button>
    </div>
  ),
}));

const person = (over: Partial<Person> & { id: number; name: string }): Person => ({
  contact: null,
  has_account: false,
  balance: 0,
  created_at: '',
  updated_at: '',
  ...over,
});

const juan = person({ id: 1, name: 'Juan Dela Cruz', balance: 525, has_account: true });
const maria = person({ id: 2, name: 'Maria Santos', balance: 0 });
const pedro = person({ id: 3, name: 'Pedro Reyes', balance: -150 });

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
        <LoansPage />
      </TopbarProvider>
    </QueryClientProvider>
  );
  return { invalidate, queryClient };
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

async function openProfile(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Profile of ${name}` }));
  return screen.findByRole('dialog', { name: `Person: ${name}` });
}

describe('LoansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs('admin');
    (listPersons as ReturnType<typeof vi.fn>).mockResolvedValue([juan, maria, pedro]);
    (searchPersons as ReturnType<typeof vi.fn>).mockResolvedValue([juan]);
    (getLedger as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  describe('access', () => {
    test('redirects a customer away and renders nothing', async () => {
      signInAs('customer');
      renderPage();
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/my-ledger'));
      expect(screen.queryByLabelText(/search people/i)).not.toBeInTheDocument();
    });
  });

  describe('listing', () => {
    test('shows each person with their balance (from the API), settled state, and account badge', async () => {
      renderPage();
      await screen.findByText('Juan Dela Cruz');
      expect(within(rowOf('Juan Dela Cruz')).getByText('₱5.25')).toBeInTheDocument();
      expect(within(rowOf('Juan Dela Cruz')).getByText(/has account/i)).toBeInTheDocument();
      expect(within(rowOf('Maria Santos')).getByText(/settled/i)).toBeInTheDocument();
      expect(within(rowOf('Maria Santos')).getByText(/no account/i)).toBeInTheDocument();
      expect(within(rowOf('Pedro Reyes')).getByText(/credit/i)).toHaveTextContent('₱1.50');
    });

    test('the balance chips filter the list', async () => {
      renderPage();
      await screen.findByText('Juan Dela Cruz');

      fireEvent.click(screen.getByRole('button', { name: /^settled$/i }));
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.queryByText('Juan Dela Cruz')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^has balance$/i }));
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Pedro Reyes')).toBeInTheDocument();
      expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^all$/i }));
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    });

    test('searching uses the search endpoint', async () => {
      renderPage();
      await screen.findByText('Maria Santos');
      fireEvent.change(screen.getByLabelText(/search people/i), { target: { value: 'dela' } });
      await waitFor(() => expect(searchPersons).toHaveBeenCalledWith('dela'));
      await waitFor(() => expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument());
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    });

    test('says so when nothing matches', async () => {
      (listPersons as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText(/no people/i)).toBeInTheDocument();
    });

    test('a failing load shows the error, not an empty table', async () => {
      (listPersons as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
      renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('db down');
      expect(screen.queryByText(/no people/i)).not.toBeInTheDocument();
    });

    test("expanding a row shows that person's ledger", async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /show ledger for juan dela cruz/i }));
      expect(screen.getByTestId('ledger')).toHaveTextContent('ledger of 1');
      fireEvent.click(screen.getByRole('button', { name: /hide ledger for juan dela cruz/i }));
      expect(screen.queryByTestId('ledger')).not.toBeInTheDocument();
    });
  });

  describe('new person', () => {
    test('creates the person and refreshes the list', async () => {
      (createPerson as ReturnType<typeof vi.fn>).mockResolvedValue(person({ id: 4, name: 'New One' }));
      const { invalidate } = renderPage();
      await screen.findByText('Juan Dela Cruz');
      fireEvent.click(screen.getByRole('button', { name: /new person/i }));
      const dialog = await screen.findByRole('dialog', { name: /new person/i });
      fireEvent.change(within(dialog).getByLabelText(/^name/i), { target: { value: 'New One' } });
      fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(createPerson).toHaveBeenCalledWith({ name: 'New One' }));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('a server error stays in the open form', async () => {
      (createPerson as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(400, { error: 'name is required' }));
      renderPage();
      await screen.findByText('Juan Dela Cruz');
      fireEvent.click(screen.getByRole('button', { name: /new person/i }));
      const dialog = await screen.findByRole('dialog', { name: /new person/i });
      fireEvent.change(within(dialog).getByLabelText(/^name/i), { target: { value: 'x' } });
      fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('name is required');
    });
  });

  describe('person profile', () => {
    test('editing saves the changes and refreshes the list', async () => {
      (updatePerson as ReturnType<typeof vi.fn>).mockResolvedValue(maria);
      const { invalidate } = renderPage();
      const dialog = await openProfile('Maria Santos');
      fireEvent.change(within(dialog).getByLabelText(/^name/i), { target: { value: 'Maria S. Santos' } });
      fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(updatePerson).toHaveBeenCalledWith(2, { name: 'Maria S. Santos', contact: null }));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] }));
    });

    test('a person with ledger history cannot be deleted: the action is disabled, not a failed API call', async () => {
      (getLedger as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 9, date: '2026-01-01', type: 'loan', description: 'rice', amount: 500, running_balance: 500 },
      ]);
      renderPage();
      const dialog = await openProfile('Maria Santos');
      await waitFor(() => expect(getLedger).toHaveBeenCalledWith(2));
      const del = within(dialog).getByRole('button', { name: /delete person/i });
      await waitFor(() => expect(del).toHaveAttribute('title', expect.stringMatching(/loan or payment history/i)));
      expect(del).toBeDisabled();
      expect(deletePerson).not.toHaveBeenCalled();
    });

    test('does not fetch any ledger until a profile is opened', async () => {
      renderPage();
      await screen.findByText('Maria Santos');
      expect(getLedger).not.toHaveBeenCalled();
    });

    test('keeps Delete disabled, saying so, when the ledger fails to load', async () => {
      (getLedger as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      renderPage();
      const dialog = await openProfile('Maria Santos');
      const del = within(dialog).getByRole('button', { name: /delete person/i });
      await waitFor(() => expect(del).toHaveAttribute('title', expect.stringMatching(/couldn.t check/i)));
      expect(del).toBeDisabled();
    });

    test('keeps Delete disabled while the ledger is still loading', async () => {
      (getLedger as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      const dialog = await openProfile('Maria Santos');
      const del = within(dialog).getByRole('button', { name: /delete person/i });
      expect(del).toBeDisabled();
      expect(del).toHaveAttribute('title', expect.stringMatching(/checking/i));
    });

    test('a person with no history can be deleted after a confirmation', async () => {
      (deletePerson as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { invalidate } = renderPage();
      const dialog = await openProfile('Maria Santos');
      const del = within(dialog).getByRole('button', { name: /delete person/i });
      await waitFor(() => expect(del).toBeEnabled());
      fireEvent.click(del);

      const confirm = await screen.findByRole('dialog', { name: /delete this person/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete person$/i }));

      await waitFor(() => expect(deletePerson).toHaveBeenCalledWith(2));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] }));
    });

    test('a failed delete shows the error inside the confirmation', async () => {
      (deletePerson as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(409, { error: 'Cannot delete a person with existing loans, payments, or a linked account' })
      );
      renderPage();
      const dialog = await openProfile('Maria Santos');
      const del = within(dialog).getByRole('button', { name: /delete person/i });
      await waitFor(() => expect(del).toBeEnabled());
      fireEvent.click(del);
      const confirm = await screen.findByRole('dialog', { name: /delete this person/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete person$/i }));
      expect(await within(confirm).findByRole('alert')).toHaveTextContent(/cannot delete a person/i);
    });

    test('creating an account shows the credentials once and refreshes people so the badge flips', async () => {
      (createAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 7,
        username: 'mariasantos',
        role: 'customer',
        person_id: 2,
        password: 'Gen3rated!!',
        created_at: '',
        updated_at: '',
      });
      const { invalidate } = renderPage();
      const dialog = await openProfile('Maria Santos');
      fireEvent.click(within(dialog).getByRole('button', { name: /create account/i }));

      await waitFor(() => expect(createAccount).toHaveBeenCalledWith({ role: 'customer', person_id: 2 }));
      const result = await screen.findByRole('dialog', { name: /account created/i });
      expect(within(result).getByText('mariasantos')).toBeInTheDocument();
      expect(within(result).getByText('Gen3rated!!')).toBeInTheDocument();
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] }));
    });

    test('does not leave the generated password in the mutation cache after Done', async () => {
      (createAccount as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 7,
        username: 'mariasantos',
        role: 'customer',
        person_id: 2,
        password: 'Gen3rated!!',
        created_at: '',
        updated_at: '',
      });
      const { queryClient } = renderPage();
      const dialog = await openProfile('Maria Santos');
      fireEvent.click(within(dialog).getByRole('button', { name: /create account/i }));
      const result = await screen.findByRole('dialog', { name: /account created/i });
      fireEvent.click(within(result).getByRole('button', { name: /done/i }));

      await waitFor(() => {
        const cached = queryClient.getMutationCache().getAll().map((m) => JSON.stringify(m.state.data ?? null));
        expect(cached.join('')).not.toContain('Gen3rated!!');
      });
    });

    test('a person who already has an account is not offered "Create account"', async () => {
      renderPage();
      const dialog = await openProfile('Juan Dela Cruz');
      expect(within(dialog).queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    });
  });

  describe('recording a loan', () => {
    test('creates the loan for that person, then refreshes balances and their ledger', async () => {
      (createLoan as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 50 });
      const { invalidate } = renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /add loan for maria santos/i }));
      expect(screen.getByText('loan for Maria Santos')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'stub-save-loan' }));

      await waitFor(() =>
        expect(createLoan).toHaveBeenCalledWith(2, { line_items: [{ description: 'rice', amount: 5800 }] })
      );
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ledger', 2] });
      });
      expect(await screen.findByTestId('ledger')).toHaveTextContent('ledger of 2');
    });

    test("a server error keeps the loan form open", async () => {
      (createLoan as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(400, { error: 'Product 9 not found' }));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /add loan for maria santos/i }));
      fireEvent.click(screen.getByRole('button', { name: 'stub-save-loan' }));
      await waitFor(() => expect(createLoan).toHaveBeenCalled());
      expect(screen.getByRole('dialog', { name: /new loan/i })).toBeInTheDocument();
    });
  });

  describe('recording a payment', () => {
    test('records it for that person, then refreshes balances and their ledger', async () => {
      (createPayment as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
      const { invalidate } = renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /add payment for juan dela cruz/i }));
      const dialog = await screen.findByRole('dialog', { name: /record payment/i });
      expect(within(dialog).getByText(/₱5\.25/)).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText(/^amount/i), { target: { value: '2.00' } });
      fireEvent.click(within(dialog).getByRole('button', { name: /record payment/i }));

      await waitFor(() => expect(createPayment).toHaveBeenCalledWith(1, { amount: 200 }));
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ledger', 1] });
      });
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /record payment/i })).not.toBeInTheDocument());
    });

    test('a server error stays in the open form', async () => {
      (createPayment as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(400, { error: 'amount must be greater than 0' }));
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /add payment for juan dela cruz/i }));
      const dialog = await screen.findByRole('dialog', { name: /record payment/i });
      fireEvent.change(within(dialog).getByLabelText(/^amount/i), { target: { value: '1' } });
      fireEvent.click(within(dialog).getByRole('button', { name: /record payment/i }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('amount must be greater than 0');
    });
  });
});
