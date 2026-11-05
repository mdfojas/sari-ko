import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import MyLedgerPage from '@/app/(app)/my-ledger/page';
import { useAuth } from '@/contexts/auth-context';
import { getMyBalance, getMyLedger, getMyLoan, getMyLoanHistory, listMyLineItems } from '@/lib/me-client';
import { ApiError } from '@/lib/api-client';
import type { Role } from '@/lib/auth-types';

const replace = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/me-client', () => ({
  getMyBalance: vi.fn(),
  getMyLedger: vi.fn(),
  getMyLoan: vi.fn(),
  listMyLineItems: vi.fn(),
  getMyLoanHistory: vi.fn(),
}));

const ledger = [
  { id: 9, date: '2026-01-01T00:00:00.000Z', type: 'loan', description: '2 canned goods', amount: 500, running_balance: 500 },
  { id: 4, date: '2026-01-05T00:00:00.000Z', type: 'payment', description: 'partial payment', amount: -300, running_balance: 200 },
];

function signInAs(role: Role) {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 3, username: 'juan', role, personId: role === 'customer' ? 1 : null },
    isLoading: false,
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TopbarProvider>
        <Topbar />
        <MyLedgerPage />
      </TopbarProvider>
    </QueryClientProvider>
  );
}

describe('MyLedgerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs('customer');
    (getMyBalance as ReturnType<typeof vi.fn>).mockResolvedValue(200);
    (getMyLedger as ReturnType<typeof vi.fn>).mockResolvedValue(ledger);
    (getMyLoan as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 9, person_id: 1, note: null, total: 500, created_at: '', updated_at: '2026-01-02T00:00:00.000Z' });
    (listMyLineItems as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 30, loan_id: 9, product_id: null, description: 'canned goods', quantity: null, unit_price: null, amount: 500, created_at: '', updated_at: '' },
    ]);
    (getMyLoanHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  describe('access', () => {
    test.each<Role>(['admin', 'store_owner'])('redirects a %s to their own landing page and renders nothing', async (role) => {
      signInAs(role);
      renderPage();
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/products'));
      expect(screen.queryByText(/current balance/i)).not.toBeInTheDocument();
      expect(getMyBalance).not.toHaveBeenCalled();
      expect(getMyLedger).not.toHaveBeenCalled();
    });
  });

  test('shows the current balance card and the ledger, from the /me endpoints only', async () => {
    renderPage();
    const card = (await screen.findByText(/current balance/i)).closest('div') as HTMLElement;
    expect(await within(card.parentElement as HTMLElement).findByText('₱2.00')).toBeInTheDocument();
    expect(await screen.findByText('2 canned goods')).toBeInTheDocument();
    expect(screen.getByText('partial payment')).toBeInTheDocument();
    expect(getMyBalance).toHaveBeenCalledTimes(1);
    expect(getMyLedger).toHaveBeenCalledTimes(1);
  });

  test('says so when the balance is settled (zero)', async () => {
    (getMyBalance as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    renderPage();
    expect(await screen.findByText(/settled/i)).toBeInTheDocument();
  });

  test('says so when the balance is negative (the customer has credit)', async () => {
    (getMyBalance as ReturnType<typeof vi.fn>).mockResolvedValue(-1500);
    renderPage();
    expect(await screen.findByText(/credit/i)).toBeInTheDocument();
    expect(screen.getByText('₱15.00')).toBeInTheDocument();
  });

  test('a failing balance shows the error, not ₱0.00', async () => {
    (getMyBalance as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
    renderPage();
    expect(await screen.findByText('db down')).toBeInTheDocument();
    expect(screen.queryByText('₱0.00')).not.toBeInTheDocument();
  });

  test('a failing ledger shows the error, not an empty ledger', async () => {
    (getMyLedger as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'ledger down' }));
    renderPage();
    expect(await screen.findByText('ledger down')).toBeInTheDocument();
    expect(screen.queryByText(/no loans or payments yet/i)).not.toBeInTheDocument();
  });

  test('renders NO mutation controls anywhere: no add loan or payment, no edit, no delete', async () => {
    renderPage();
    await screen.findByText('2 canned goods');
    fireEvent.click(screen.getByRole('button', { name: /show items for loan 9/i }));
    await screen.findByText('canned goods');

    for (const name of [/\+ ?loan/i, /\+ ?payment/i, /add/i, /edit/i, /delete/i, /remove/i, /record/i, /new /i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('🗑️')).not.toBeInTheDocument();
  });

  test('a loan drills into its items and history through the /me bridges', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /show items for loan 9/i }));
    expect(await screen.findByText('canned goods')).toBeInTheDocument();
    expect(listMyLineItems).toHaveBeenCalledWith(9);
    expect(getMyLoan).toHaveBeenCalledWith(9);

    fireEvent.click(screen.getByRole('button', { name: /view history/i }));
    await screen.findByRole('dialog', { name: /loan history/i });
    expect(getMyLoanHistory).toHaveBeenCalledWith(9);
  });
});
