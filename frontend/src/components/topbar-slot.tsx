'use client';

import { useEffect, type ReactNode } from 'react';
import { useTopbar } from '@/contexts/topbar-context';

// Lets a page declaratively register its own title/search/filter controls
// into the shared topbar, without the topbar needing to know about routes.
export function TopbarSlot({ children }: { children: ReactNode }) {
  const { setContent } = useTopbar();

  useEffect(() => {
    setContent(children);
    return () => setContent(null);
  }, [children, setContent]);

  return null;
}
