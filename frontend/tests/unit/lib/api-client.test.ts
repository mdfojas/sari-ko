import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api-client';
import { clearToken, setToken } from '@/lib/token-storage';

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('calls fetch with a URL containing the given path', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiFetch('/health');

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/health');
  });

  test('omits the Authorization header when no token is stored', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 })
    );

    await apiFetch('/health');

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  test('attaches a Bearer Authorization header when a token is stored', async () => {
    setToken('my-jwt');
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 })
    );

    await apiFetch('/products');

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer my-jwt');
  });

  test('parses and returns the JSON response body', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ hello: 'world' }), { status: 200 })
    );

    const result = await apiFetch<{ hello: string }>('/whatever');

    expect(result).toEqual({ hello: 'world' });
  });

  test('throws ApiError with the status and parsed body on a non-ok response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ message: 'nope' }), { status: 403 })
    );

    const error: unknown = await apiFetch('/nope').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      body: { message: 'nope' },
    });
  });

  test('rejects with a timeout error if the request never resolves', async () => {
    vi.useFakeTimers();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const promise = apiFetch('/slow');
    const assertion = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(130_000);
    await assertion;
  });
});
