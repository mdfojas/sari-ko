import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoanLineItems } from '@/components/loan-line-items';
import { getLoan, listLineItems, getLoanHistory } from '@/lib/loans-client';
import { getMyLoan, listMyLineItems, getMyLoanHistory } from '@/lib/me-client';

vi.mock('@/lib/loans-client', () => ({
  getLoan: vi.fn(),
  listLineItems: vi.fn(),
  getLoanHistory: vi.fn(),
  deleteLineItem: vi.fn(),
  deleteLoan: vi.fn(),
}));
vi.mock('@/lib/me-client', () => ({ getMyLoan: vi.fn(), listMyLineItems: vi.fn(), getMyLoanHistory: vi.fn() }));

const loan = { id: 9, person_id: 2, note: null, total: 1500, created_at: '', updated_at: '2026-01-05T00:00:00.000Z' };
const item = { id: 31, loan_id: 9, product_id: null, description: 'Kulang', quantity: null, unit_price: null, amount: 1500, created_at: '', updated_at: '' };

function renderIt(scope?: 'me') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LoanLineItems loanId={9} personId={2} scope={scope} />
    </QueryClientProvider>
  );
  return { queryClient };
}

describe('LoanLineItems in the customer ("me") scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getMyLoan as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    (listMyLineItems as ReturnType<typeof vi.fn>).mockResolvedValue([item]);
    (getMyLoanHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  test('reads through the /me bridges and never touches the staff endpoints', async () => {
    renderIt('me');
    expect(await screen.findByText('Kulang')).toBeInTheDocument();
    expect(getMyLoan).toHaveBeenCalledWith(9);
    expect(listMyLineItems).toHaveBeenCalledWith(9);
    expect(getLoan).not.toHaveBeenCalled();
    expect(listLineItems).not.toHaveBeenCalled();
  });

  test('renders no delete control at all', async () => {
    renderIt('me');
    await screen.findByText('Kulang');
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText('🗑️')).not.toBeInTheDocument();
  });

  test('"View history" opens the history from the /me bridge', async () => {
    renderIt('me');
    fireEvent.click(await screen.findByRole('button', { name: /view history/i }));
    expect(await screen.findByRole('dialog', { name: /loan history/i })).toBeInTheDocument();
    expect(getMyLoanHistory).toHaveBeenCalledWith(9);
    expect(getLoanHistory).not.toHaveBeenCalled();
  });

  test('caches under a separate "me" key so it can never collide with the staff cache', async () => {
    const { queryClient } = renderIt('me');
    await screen.findByText('Kulang');
    expect(queryClient.getQueryData(['me', 'loan-line-items', 9])).toBeDefined();
    expect(queryClient.getQueryData(['loan-line-items', 9])).toBeUndefined();
    expect(queryClient.getQueryData(['me', 'loan', 9])).toBeDefined();
    expect(queryClient.getQueryData(['loan', 9])).toBeUndefined();
  });
});

describe('LoanLineItems in the default (staff) scope', () => {
  test('still shows the delete control', async () => {
    (getLoan as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    (listLineItems as ReturnType<typeof vi.fn>).mockResolvedValue([item]);
    renderIt();
    await screen.findByText('Kulang');
    expect(screen.getByRole('button', { name: /delete kulang/i })).toBeInTheDocument();
  });
});
