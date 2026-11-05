import { apiFetch } from './api-client';
import type { Loan, LineItem, LoanHistoryEntry } from './loans-client';
import type { LedgerEntry } from './persons-client';

// The customer-only reads. Most resolve the person from the signed-in
// account, so no person id ever appears in a URL; the loan drill-ins take a
// loan id but are ownership-checked by the backend (someone else's loan is a
// 404, same as a missing one).
export async function getMyBalance(): Promise<number> {
  const { balance } = await apiFetch<{ balance: number }>('/me/balance');
  return balance;
}

export function getMyLedger(): Promise<LedgerEntry[]> {
  return apiFetch<LedgerEntry[]>('/me/ledger');
}

export function getMyLoan(id: number): Promise<Loan> {
  return apiFetch<Loan>(`/me/loans/${id}`);
}

export function listMyLineItems(loanId: number): Promise<LineItem[]> {
  return apiFetch<LineItem[]>(`/me/loans/${loanId}/line-items`);
}

export function getMyLoanHistory(loanId: number): Promise<LoanHistoryEntry[]> {
  return apiFetch<LoanHistoryEntry[]>(`/me/loans/${loanId}/history`);
}
