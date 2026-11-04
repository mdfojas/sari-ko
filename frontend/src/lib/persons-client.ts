import { apiFetch } from './api-client';

export interface Person {
  id: number;
  name: string;
  contact: string | null;
  has_account: boolean;
  created_at: string;
  updated_at: string;
}

export function listPersons(): Promise<Person[]> {
  return apiFetch<Person[]>('/persons');
}
