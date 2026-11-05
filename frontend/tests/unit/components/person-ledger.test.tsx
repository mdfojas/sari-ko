import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonLedger } from '@/components/person-ledger';
import { getLedger, type LedgerEntry } from '@/lib/persons-client';
import { getMyLedger } from '@/lib/me-client';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/persons-client', () => ({ getLedger: vi.fn() }));
vi.mock('@/lib/me-client', () => ({ getMyLedger: vi.fn() }));
vi.mock('@/components/loan-line-items', () => ({
  LoanLineItems: ({ loanId, personId, scope }: { loanId: number; personId: number; scope?: string }) => (
    <div data-testid="line-items">{`items of loan ${loanId} (person ${personId}, scope ${scope ?? 'staff'})`}</div>
  ),
}));

const ledger: LedgerEntry[] = [
  { id: 9, date: '2026-01-01T00:00:00.000Z', type: 'loan', description: '2 canned goods', amount: 500, running_balance: 500 },
  { id: 4, date: '2026-01-05T00:00:00.000Z', type: 'payment', description: 'partial payment', amount: -300, running_balance: 200 },
];

function renderLedger() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PersonLedger scope="staff" personId={2} />
    </QueryClientProvider>
  );
}

describe('PersonLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getLedger as ReturnType<typeof vi.fn>).mockResolvedValue(ledger);
  });

  test('lists loans and payments chronologically with a signed amount and the running balance', async () => {
    renderLedger();
    const loanRow = (await screen.findByText('2 canned goods')).closest('tr') as HTMLElement;
    const paymentRow = screen.getByText('partial payment').closest('tr') as HTMLElement;

    expect(getLedger).toHaveBeenCalledWith(2);
    expect(within(loanRow).getByText('+₱5.00')).toBeInTheDocument();
    expect(within(loanRow).getByText('₱5.00', { selector: 'td:last-child' })).toBeInTheDocument();
    expect(within(paymentRow).getByText('−₱3.00')).toBeInTheDocument();
    expect(within(paymentRow).getByText('₱2.00', { selector: 'td:last-child' })).toBeInTheDocument();
  });

  test('a loan can be expanded to its line items and collapsed again; a payment has nothing to expand', async () => {
    renderLedger();
    await screen.findByText('2 canned goods');
    expect(screen.queryByTestId('line-items')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show items for loan/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByTestId('line-items')).toHaveTextContent('items of loan 9 (person 2, scope staff)');
    expect(screen.getByRole('button', { name: /hide items for loan/i })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /hide items for loan/i }));
    expect(screen.queryByTestId('line-items')).not.toBeInTheDocument();

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  test('says so when there is nothing yet', async () => {
    (getLedger as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderLedger();
    expect(await screen.findByText(/no loans or payments yet/i)).toBeInTheDocument();
  });

  test('a failing load shows the error, not an empty ledger', async () => {
    (getLedger as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
    renderLedger();
    expect(await screen.findByRole('alert')).toHaveTextContent('db down');
    expect(screen.queryByText(/no loans or payments yet/i)).not.toBeInTheDocument();
  });
});

describe('PersonLedger in the customer ("me") scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getMyLedger as ReturnType<typeof vi.fn>).mockResolvedValue(ledger);
  });

  function renderMine() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PersonLedger scope="me" />
      </QueryClientProvider>
    );
    return { queryClient };
  }

  test('reads /me/ledger, never a person id from the URL, and caches under a "me" key', async () => {
    const { queryClient } = renderMine();
    expect(await screen.findByText('2 canned goods')).toBeInTheDocument();
    expect(getMyLedger).toHaveBeenCalledTimes(1);
    expect(getLedger).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['me', 'ledger'])).toBeDefined();
  });

  test('expanding a loan hands the line items the "me" scope', async () => {
    renderMine();
    fireEvent.click(await screen.findByRole('button', { name: /show items for loan 9/i }));
    expect(screen.getByTestId('line-items')).toHaveTextContent('scope me');
  });
});
