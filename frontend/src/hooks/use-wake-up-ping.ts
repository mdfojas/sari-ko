import { useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';

function defaultPing(): void {
  apiFetch('/health').catch(() => {
    // Fire-and-forget: a failed wake-up ping is not user-facing.
  });
}

export function useWakeUpPing(ping: () => void = defaultPing): void {
  useEffect(() => {
    ping();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        ping();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [ping]);
}
