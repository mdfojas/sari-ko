import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Providers } from '@/app/providers';
import { useWakeUpPing } from '@/hooks/use-wake-up-ping';

vi.mock('@/hooks/use-wake-up-ping', () => ({ useWakeUpPing: vi.fn() }));

describe('Providers', () => {
  test('wires up the cold-start wake-up ping', () => {
    render(<Providers>{null}</Providers>);
    expect(useWakeUpPing).toHaveBeenCalled();
  });
});
