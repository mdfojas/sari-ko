import { describe, expect, test } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { TopbarProvider, useTopbar } from '@/contexts/topbar-context';

describe('TopbarProvider / useTopbar', () => {
  test('starts with no content', () => {
    const { result } = renderHook(() => useTopbar(), { wrapper: TopbarProvider });
    expect(result.current.content).toBeNull();
  });

  test('setContent updates what is exposed', () => {
    const { result } = renderHook(() => useTopbar(), { wrapper: TopbarProvider });

    act(() => {
      result.current.setContent('hello');
    });

    expect(result.current.content).toBe('hello');
  });

  test('useTopbar throws when used outside a TopbarProvider', () => {
    expect(() => renderHook(() => useTopbar())).toThrow(/TopbarProvider/);
  });
});
