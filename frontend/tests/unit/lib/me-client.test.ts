import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getMyBalance, getMyLedger, getMyLoan, getMyLoanHistory, listMyLineItems } from '@/lib/me-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('me-client (the customer-only /me/* reads)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  test('getMyBalance reads GET /me/balance and unwraps the number', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: 12500 });
    expect(await getMyBalance()).toBe(12500);
    expect(apiFetch).toHaveBeenCalledWith('/me/balance');
  });

  test('getMyLedger reads GET /me/ledger', async () => {
    await getMyLedger();
    expect(apiFetch).toHaveBeenCalledWith('/me/ledger');
  });

  // Loan drill-ins use the ownership-checked /me bridges, never /loans/:id.
  test.each([
    ['getMyLoan', () => getMyLoan(9), '/me/loans/9'],
    ['listMyLineItems', () => listMyLineItems(9), '/me/loans/9/line-items'],
    ['getMyLoanHistory', () => getMyLoanHistory(9), '/me/loans/9/history'],
  ])('%s reads %s', async (_name, call, path) => {
    await call();
    expect(apiFetch).toHaveBeenCalledWith(path);
  });
});
