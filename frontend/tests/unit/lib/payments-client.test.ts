import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPayment, deletePayment } from '@/lib/payments-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('payments-client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('createPayment POSTs to /persons/:id/payments', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    await createPayment(2, { amount: 5000, note: 'partial' });
    expect(apiFetch).toHaveBeenCalledWith('/persons/2/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 5000, note: 'partial' }),
    });
  });

  test('deletePayment DELETEs /payments/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await deletePayment(4);
    expect(apiFetch).toHaveBeenCalledWith('/payments/4', { method: 'DELETE' });
  });
});
