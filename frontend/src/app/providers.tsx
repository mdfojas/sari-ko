'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWakeUpPing } from '@/hooks/use-wake-up-ping';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useWakeUpPing();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
