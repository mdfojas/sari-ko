import { apiFetch } from './api-client';

export interface Loan {
  id: number;
  person_id: number;
  note: string | null;
  // Sum of the loan's line items, in centavos.
  total: number;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: number;
  loan_id: number;
  // Null for a freeform item — and also for a catalog item whose product was
  // later deleted, which is why "catalog vs freeform" is judged by unit_price.
  product_id: number | null;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

// A catalog item sends product + quantity (the backend snapshots the price);
// a freeform item sends a description + amount in centavos.
export type NewLineItem = { product_id: number; quantity: number } | { description: string; amount: number };

export interface CreateLoanInput {
  note?: string;
  line_items: NewLineItem[];
}

export interface LoanHistoryEntry {
  id: number;
  entity_type: 'loan' | 'loan_line_item' | 'payment';
  entity_id: number;
  action: 'create' | 'update' | 'delete';
  // create/delete: the full row snapshot. update: { field: { from, to } }.
  changes: Record<string, unknown>;
  created_at: string;
}

export function createLoan(personId: number, input: CreateLoanInput): Promise<Loan> {
  return apiFetch<Loan>(`/persons/${personId}/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getLoan(id: number): Promise<Loan> {
  return apiFetch<Loan>(`/loans/${id}`);
}

export function listLineItems(loanId: number): Promise<LineItem[]> {
  return apiFetch<LineItem[]>(`/loans/${loanId}/line-items`);
}

export function getLoanHistory(loanId: number): Promise<LoanHistoryEntry[]> {
  return apiFetch<LoanHistoryEntry[]>(`/loans/${loanId}/history`);
}

export function deleteLoan(id: number): Promise<void> {
  return apiFetch<void>(`/loans/${id}`, { method: 'DELETE' });
}

export function deleteLineItem(id: number): Promise<void> {
  return apiFetch<void>(`/line-items/${id}`, { method: 'DELETE' });
}
