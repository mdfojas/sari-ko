import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoanHistoryModal } from '@/components/loan-history-modal';
import { getLoanHistory, type LoanHistoryEntry } from '@/lib/loans-client';
import { getMyLoanHistory } from '@/lib/me-client';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/loans-client', () => ({ getLoanHistory: vi.fn() }));
vi.mock('@/lib/me-client', () => ({ getMyLoanHistory: vi.fn() }));

const entries: LoanHistoryEntry[] = [
  { id: 1, entity_type: 'loan', entity_id: 9, action: 'create', changes: {}, created_at: '2026-01-01T00:00:00.000Z' },
  {
    id: 2,
    entity_type: 'loan_line_item',
    entity_id: 30,
    action: 'create',
    changes: { description: '1kg rice', amount: 5800 },
    created_at: '2026-01-01T00:00:01.000Z',
  },
  {
    id: 3,
    entity_type: 'loan_line_item',
    entity_id: 30,
    action: 'update',
    changes: { amount: { from: 5800, to: 6000 } },
    created_at: '2026-01-02T00:00:00.000Z',
  },
];

function renderModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LoanHistoryModal loanId={9} onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

describe('LoanHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getLoanHistory as ReturnType<typeof vi.fn>).mockResolvedValue(entries);
  });

  test('lists each change, oldest first, in plain words', async () => {
    renderModal();
    expect(await screen.findByText('Loan created')).toBeInTheDocument();
    expect(screen.getByText('Added "1kg rice" (₱58.00)')).toBeInTheDocument();
    expect(screen.getByText('Line item changed: amount ₱58.00 → ₱60.00')).toBeInTheDocument();
    expect(getLoanHistory).toHaveBeenCalledWith(9);
  });

  test('says so when there is no history', async () => {
    (getLoanHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderModal();
    expect(await screen.findByText(/no history/i)).toBeInTheDocument();
  });

  test('a failing load shows the error, not an empty history', async () => {
    (getLoanHistory as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
    renderModal();
    expect(await screen.findByRole('alert')).toHaveTextContent('db down');
    expect(screen.queryByText(/no history/i)).not.toBeInTheDocument();
  });

  test('Close calls onClose', async () => {
    const { onClose } = renderModal();
    await screen.findByText('Loan created');
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('LoanHistoryModal in the customer ("me") scope', () => {
  test('reads the ownership-checked /me history, not the staff endpoint', async () => {
    vi.clearAllMocks();
    (getMyLoanHistory as ReturnType<typeof vi.fn>).mockResolvedValue(entries);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LoanHistoryModal loanId={9} scope="me" onClose={vi.fn()} />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Loan created')).toBeInTheDocument();
    expect(getMyLoanHistory).toHaveBeenCalledWith(9);
    expect(getLoanHistory).not.toHaveBeenCalled();
  });
});
