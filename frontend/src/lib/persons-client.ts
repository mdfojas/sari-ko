import { apiFetch } from './api-client';

export interface Person {
  id: number;
  name: string;
  contact: string | null;
  has_account: boolean;
  // Loans minus payments, in centavos. Positive means the person owes money.
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface PersonInput {
  name: string;
  contact?: string | null;
}

// `id` is the loan's or payment's own id, according to `type`.
export interface LedgerEntry {
  id: number;
  date: string;
  type: 'loan' | 'payment';
  description: string;
  // Positive for a loan, negative for a payment.
  amount: number;
  running_balance: number;
}

export function listPersons(): Promise<Person[]> {
  return apiFetch<Person[]>('/persons');
}

export function searchPersons(query: string): Promise<Person[]> {
  return apiFetch<Person[]>(`/persons/search?q=${encodeURIComponent(query)}`);
}

export function createPerson(input: PersonInput): Promise<Person> {
  return apiFetch<Person>('/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updatePerson(id: number, input: Partial<PersonInput>): Promise<Person> {
  return apiFetch<Person>(`/persons/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deletePerson(id: number): Promise<void> {
  return apiFetch<void>(`/persons/${id}`, { method: 'DELETE' });
}

export function getLedger(personId: number): Promise<LedgerEntry[]> {
  return apiFetch<LedgerEntry[]>(`/persons/${personId}/ledger`);
}
