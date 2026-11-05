import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersonLedger } from '@/components/person-ledger';
import { getLedger, type LedgerEntry } from '@/lib/persons-client';
import { getMyLedger } from '@/lib/me-client';
import { deletePayment } from '@/lib/payments-client';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/persons-client', () => ({ getLedger: vi.fn() }));
vi.mock('@/lib/me-client', () => ({ getMyLedger: vi.fn() }));
vi.mock('@/lib/payments-client', () => ({ deletePayment: vi.fn() }));
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <PersonLedger scope="staff" personId={2} />
    </QueryClientProvider>
  );
  return { invalidate };
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
    expect(within(loanRow).getByText('₱5.00', { selector: 'td:nth-last-child(2)' })).toBeInTheDocument();
    expect(within(paymentRow).getByText('−₱3.00')).toBeInTheDocument();
    expect(within(paymentRow).getByText('₱2.00', { selector: 'td:nth-last-child(2)' })).toBeInTheDocument();
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

    // Only the loan has an expander; the payment's only button is Delete.
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /show items|hide items/i })).toHaveLength(1);
  });

  describe('deleting a payment (staff)', () => {
    const deleteButton = () => screen.getByRole('button', { name: /delete payment/i });

    test('a payment row has a delete control; a loan row does not (its items are deleted inside it)', async () => {
      renderLedger();
      const loanRow = (await screen.findByText('2 canned goods')).closest('tr') as HTMLElement;
      const paymentRow = screen.getByText('partial payment').closest('tr') as HTMLElement;
      expect(within(paymentRow).getByRole('button', { name: /delete payment/i })).toBeInTheDocument();
      expect(within(loanRow).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /delete payment/i })).toHaveLength(1);
    });

    test('asks for confirmation naming the payment and what happens to the balance; Cancel keeps it', async () => {
      renderLedger();
      await screen.findByText('partial payment');
      fireEvent.click(deleteButton());

      const dialog = await screen.findByRole('dialog', { name: /delete this payment/i });
      expect(within(dialog).getByText(/partial payment/)).toBeInTheDocument();
      expect(within(dialog).getByText(/₱3\.00/)).toBeInTheDocument();
      expect(within(dialog).getByText(/balance/i)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deletePayment).not.toHaveBeenCalled();
    });

    test('confirming deletes that payment and refreshes the ledger and the people list (balances)', async () => {
      (deletePayment as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const { invalidate } = renderLedger();
      await screen.findByText('partial payment');
      fireEvent.click(deleteButton());
      const dialog = await screen.findByRole('dialog', { name: /delete this payment/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /^delete payment$/i }));

      await waitFor(() => expect(deletePayment).toHaveBeenCalledWith(4));
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ledger', 2] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('a failed delete shows the error inside the dialog and keeps it open', async () => {
      (deletePayment as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'Payment not found' }));
      renderLedger();
      await screen.findByText('partial payment');
      fireEvent.click(deleteButton());
      const dialog = await screen.findByRole('dialog', { name: /delete this payment/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /^delete payment$/i }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Payment not found');
      expect(screen.getByRole('dialog', { name: /delete this payment/i })).toBeInTheDocument();
    });

    test('an error from an earlier attempt is gone when the dialog is opened again', async () => {
      (deletePayment as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      renderLedger();
      await screen.findByText('partial payment');
      fireEvent.click(deleteButton());
      let dialog = await screen.findByRole('dialog', { name: /delete this payment/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /^delete payment$/i }));
      await within(dialog).findByRole('alert');
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      fireEvent.click(deleteButton());
      dialog = await screen.findByRole('dialog', { name: /delete this payment/i });
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    });

    test('locks the confirm button while the delete is in flight', async () => {
      (deletePayment as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderLedger();
      await screen.findByText('partial payment');
      fireEvent.click(deleteButton());
      const dialog = await screen.findByRole('dialog', { name: /delete this payment/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /^delete payment$/i }));

      await waitFor(() => expect(within(dialog).getByRole('button', { name: /working/i })).toBeDisabled());
      expect(deletePayment).toHaveBeenCalledTimes(1);
    });
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

  test('a customer gets no delete control on any row', async () => {
    renderMine();
    await screen.findByText('partial payment');
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  test('expanding a loan hands the line items the "me" scope', async () => {
    renderMine();
    fireEvent.click(await screen.findByRole('button', { name: /show items for loan 9/i }));
    expect(screen.getByTestId('line-items')).toHaveTextContent('scope me');
  });
});
