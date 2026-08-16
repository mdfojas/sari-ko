import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWakeUpPing } from '@/hooks/use-wake-up-ping';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn().mockResolvedValue({}) }));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('useWakeUpPing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('pings once on mount', () => {
    const ping = vi.fn();
    renderHook(() => useWakeUpPing(ping));
    expect(ping).toHaveBeenCalledTimes(1);
  });

  test('pings again when the tab becomes visible', () => {
    const ping = vi.fn();
    renderHook(() => useWakeUpPing(ping));
    ping.mockClear();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(ping).toHaveBeenCalledTimes(1);
  });

  test('does not ping when the tab becomes hidden', () => {
    const ping = vi.fn();
    renderHook(() => useWakeUpPing(ping));
    ping.mockClear();

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(ping).not.toHaveBeenCalled();
  });

  test('never pings again on a periodic timer while idle', () => {
    const ping = vi.fn();
    renderHook(() => useWakeUpPing(ping));
    ping.mockClear();

    vi.advanceTimersByTime(30 * 60 * 1000); // 30 idle minutes, no refocus event

    expect(ping).not.toHaveBeenCalled();
  });

  test('the default ping calls apiFetch("/health") instead of duplicating base-URL logic', () => {
    renderHook(() => useWakeUpPing());
    expect(apiFetch).toHaveBeenCalledWith('/health');
  });

  test('stops listening after unmount', () => {
    const ping = vi.fn();
    const { unmount } = renderHook(() => useWakeUpPing(ping));
    ping.mockClear();
    unmount();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(ping).not.toHaveBeenCalled();
  });
});
