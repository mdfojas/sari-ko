import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createPerson,
  deletePerson,
  getLedger,
  listPersons,
  searchPersons,
  updatePerson,
} from '@/lib/persons-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('persons-client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('listPersons fetches GET /persons', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listPersons();
    expect(apiFetch).toHaveBeenCalledWith('/persons');
  });

  test('searchPersons fetches GET /persons/search with the query encoded', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await searchPersons('dela cruz');
    expect(apiFetch).toHaveBeenCalledWith('/persons/search?q=dela%20cruz');
  });

  test('createPerson POSTs to /persons', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    await createPerson({ name: 'Juan', contact: '0917' });
    expect(apiFetch).toHaveBeenCalledWith('/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Juan', contact: '0917' }),
    });
  });

  test('updatePerson PATCHes /persons/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
    await updatePerson(1, { name: 'Juan D.' });
    expect(apiFetch).toHaveBeenCalledWith('/persons/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Juan D.' }),
    });
  });

  test('deletePerson DELETEs /persons/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await deletePerson(1);
    expect(apiFetch).toHaveBeenCalledWith('/persons/1', { method: 'DELETE' });
  });

  test('getLedger fetches GET /persons/:id/ledger', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await getLedger(4);
    expect(apiFetch).toHaveBeenCalledWith('/persons/4/ledger');
  });
});
