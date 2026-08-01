import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../../../src/shared/transaction.js';

function fakePool(client: Partial<PoolClient>) {
  return { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
}

describe('withTransaction', () => {
  it('commits when the work succeeds', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    const pool = fakePool(client);

    const result = await withTransaction(pool, async () => 'done');

    expect(result).toBe('done');
    expect(client.query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back and rethrows when the work fails', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    const pool = fakePool(client);
    const failure = new Error('boom');

    await expect(
      withTransaction(pool, async () => {
        throw failure;
      }),
    ).rejects.toThrow(failure);

    expect(client.query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
