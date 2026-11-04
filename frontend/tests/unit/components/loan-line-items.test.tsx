import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoanLineItems } from '@/components/loan-line-items';
import {
  deleteLineItem,
  deleteLoan,
  getLoan,
  getLoanHistory,
  listLineItems,
  type LineItem,
  type Loan,
} from '@/lib/loans-client';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/loans-client', () => ({
  getLoan: vi.fn(),
  listLineItems: vi.fn(),
  deleteLineItem: vi.fn(),
  deleteLoan: vi.fn(),
  getLoanHistory: vi.fn(),
}));

const loan: Loan = {
  id: 9,
  person_id: 2,
  note: null,
  total: 7300,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-05T00:00:00.000Z',
};

const catalogItem: LineItem = {
  id: 30,
  loan_id: 9,
  product_id: 5,
  description: 'Coca-Cola 1.5L',
  quantity: 2,
  unit_price: 8500,
  amount: 17000,
  created_at: '',
  updated_at: '',
};
const freeformItem: LineItem = {
  id: 31,
  loan_id: 9,
  product_id: null,
  description: 'Kulang',
  quantity: null,
  unit_price: null,
  amount: 1500,
  created_at: '',
  updated_at: '',
};

function renderIt() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <LoanLineItems loanId={9} personId={2} />
    </QueryClientProvider>
  );
  return { invalidate };
}

describe('LoanLineItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getLoan as ReturnType<typeof vi.fn>).mockResolvedValue(loan);
    (listLineItems as ReturnType<typeof vi.fn>).mockResolvedValue([catalogItem, freeformItem]);
    (getLoanHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  test('lists each item, tagged catalog or freeform, with quantity x unit price for catalog items', async () => {
    renderIt();
    const catalogRow = (await screen.findByText('Coca-Cola 1.5L')).closest('tr') as HTMLElement;
    const freeformRow = screen.getByText('Kulang').closest('tr') as HTMLElement;

    expect(within(catalogRow).getByText('Catalog')).toBeInTheDocument();
    expect(within(catalogRow).getByText(/2 × ₱85\.00/)).toBeInTheDocument();
    expect(within(catalogRow).getByText('₱170.00')).toBeInTheDocument();
    expect(within(freeformRow).getByText('Freeform')).toBeInTheDocument();
    expect(within(freeformRow).queryByText(/×/)).not.toBeInTheDocument();
    expect(within(freeformRow).getByText('₱15.00')).toBeInTheDocument();
  });

  test('shows when the loan was last updated, with a "View history" link that opens the history', async () => {
    renderIt();
    expect(await screen.findByText(/last updated/i)).toHaveTextContent(/2026/);
    fireEvent.click(screen.getByRole('button', { name: /view history/i }));
    expect(await screen.findByRole('dialog', { name: /loan history/i })).toBeInTheDocument();
    expect(getLoanHistory).toHaveBeenCalledWith(9);
  });

  test('a failing load shows the error, not an empty list', async () => {
    (listLineItems as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
    renderIt();
    expect(await screen.findByRole('alert')).toHaveTextContent('db down');
  });

  describe('removing a line item', () => {
    test('with others remaining: confirms, then deletes just that item and refreshes the ledger and balances', async () => {
      (deleteLineItem as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { invalidate } = renderIt();
      fireEvent.click(await screen.findByRole('button', { name: /delete kulang/i }));

      const confirm = await screen.findByRole('dialog', { name: /delete this line item/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete item$/i }));

      await waitFor(() => expect(deleteLineItem).toHaveBeenCalledWith(31));
      expect(deleteLoan).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan-line-items', 9] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ledger', 2] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
      });
    });

    test("removing a loan's only line item offers Cancel / Delete Loan instead of calling the line-item delete", async () => {
      (listLineItems as ReturnType<typeof vi.fn>).mockResolvedValue([catalogItem]);
      (deleteLoan as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { invalidate } = renderIt();
      fireEvent.click(await screen.findByRole('button', { name: /delete coca-cola/i }));

      const confirm = await screen.findByRole('dialog', { name: /delete this loan/i });
      expect(within(confirm).getByText(/only line item/i)).toBeInTheDocument();
      expect(within(confirm).getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete loan$/i }));

      await waitFor(() => expect(deleteLoan).toHaveBeenCalledWith(9));
      expect(deleteLineItem).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['ledger', 2] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['persons'] });
      });
    });

    test('cancelling deletes nothing', async () => {
      (listLineItems as ReturnType<typeof vi.fn>).mockResolvedValue([catalogItem]);
      renderIt();
      fireEvent.click(await screen.findByRole('button', { name: /delete coca-cola/i }));
      const confirm = await screen.findByRole('dialog', { name: /delete this loan/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /^cancel$/i }));
      expect(deleteLoan).not.toHaveBeenCalled();
      expect(deleteLineItem).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('a failed delete shows the error inside the dialog', async () => {
      (deleteLineItem as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'Line item not found' }));
      renderIt();
      fireEvent.click(await screen.findByRole('button', { name: /delete kulang/i }));
      const confirm = await screen.findByRole('dialog', { name: /delete this line item/i });
      fireEvent.click(within(confirm).getByRole('button', { name: /^delete item$/i }));
      expect(await within(confirm).findByRole('alert')).toHaveTextContent('Line item not found');
    });
  });
});
