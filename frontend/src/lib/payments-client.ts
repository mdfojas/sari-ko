import { apiFetch } from './api-client';

export interface Payment {
  id: number;
  person_id: number;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentInput {
  amount: number;
  note?: string | null;
}

export function createPayment(personId: number, input: PaymentInput): Promise<Payment> {
  return apiFetch<Payment>(`/persons/${personId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
