import { describe, expect, test, vi } from 'vitest';
import { listDistinctStoreNames } from '@/lib/store-prices-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('listDistinctStoreNames', () => {
  test('fetches GET /store-prices/distinct-names', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(['Puregold', 'SM Supermarket']);
    const result = await listDistinctStoreNames();
    expect(apiFetch).toHaveBeenCalledWith('/store-prices/distinct-names');
    expect(result).toEqual(['Puregold', 'SM Supermarket']);
  });
});
