import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createLoan,
  deleteLineItem,
  deleteLoan,
  getLoan,
  getLoanHistory,
  listLineItems,
} from '@/lib/loans-client';
import { createPayment } from '@/lib/payments-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('loans-client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('createLoan POSTs mixed catalog and freeform line items to /persons/:id/loans', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 9 });
    await createLoan(2, {
      note: 'weekly',
      line_items: [
        { product_id: 5, quantity: 2 },
        { description: 'Kulang', amount: 1500 },
      ],
    });
    expect(apiFetch).toHaveBeenCalledWith('/persons/2/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: 'weekly',
        line_items: [
          { product_id: 5, quantity: 2 },
          { description: 'Kulang', amount: 1500 },
        ],
      }),
    });
  });

  test('getLoan fetches GET /loans/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 9 });
    await getLoan(9);
    expect(apiFetch).toHaveBeenCalledWith('/loans/9');
  });

  test('listLineItems fetches GET /loans/:id/line-items', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listLineItems(9);
    expect(apiFetch).toHaveBeenCalledWith('/loans/9/line-items');
  });

  test('getLoanHistory fetches GET /loans/:id/history', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getLoanHistory(9);
    expect(apiFetch).toHaveBeenCalledWith('/loans/9/history');
  });

  test('deleteLoan DELETEs /loans/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await deleteLoan(9);
    expect(apiFetch).toHaveBeenCalledWith('/loans/9', { method: 'DELETE' });
  });

  test('deleteLineItem DELETEs /line-items/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await deleteLineItem(30);
    expect(apiFetch).toHaveBeenCalledWith('/line-items/30', { method: 'DELETE' });
  });
});

describe('payments-client', () => {
  test('createPayment POSTs the amount and note to /persons/:id/payments', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    await createPayment(2, { amount: 1000, note: 'partial' });
    expect(apiFetch).toHaveBeenCalledWith('/persons/2/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, note: 'partial' }),
    });
  });
});
