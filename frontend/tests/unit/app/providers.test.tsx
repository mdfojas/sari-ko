import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Providers } from '@/app/providers';
import { useWakeUpPing } from '@/hooks/use-wake-up-ping';

vi.mock('@/hooks/use-wake-up-ping', () => ({ useWakeUpPing: vi.fn() }));
vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="auth-provider-stub">{children}</div>
  ),
}));

describe('Providers', () => {
  test('wires up the cold-start wake-up ping', () => {
    render(<Providers>{null}</Providers>);
    expect(useWakeUpPing).toHaveBeenCalled();
  });

  test('wraps children in AuthProvider', () => {
    render(
      <Providers>
        <div data-testid="child" />
      </Providers>
    );
    const stub = screen.getByTestId('auth-provider-stub');
    expect(stub).toContainElement(screen.getByTestId('child'));
  });
});
