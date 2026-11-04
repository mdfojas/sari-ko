import { describe, expect, test, vi } from 'vitest';
import { listPersons } from '@/lib/persons-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('listPersons', () => {
  test('fetches GET /persons', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listPersons();
    expect(apiFetch).toHaveBeenCalledWith('/persons');
  });
});
