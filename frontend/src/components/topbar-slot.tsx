'use client';

import { useLayoutEffect, type ReactNode } from 'react';
import { useTopbar } from '@/contexts/topbar-context';

// Lets a page declaratively register its own title/search/filter controls
// into the shared topbar, without the topbar needing to know about routes.
// Uses useLayoutEffect, not useEffect: Topbar renders this content from
// context, not TopbarSlot itself, so a post-paint effect would let one
// frame commit with Topbar still showing the previous render's content
// (visible as a one-keystroke-stale flicker in a fast-typed search box).
export function TopbarSlot({ children }: { children: ReactNode }) {
  const { setContent } = useTopbar();

  useLayoutEffect(() => {
    setContent(children);
    return () => setContent(null);
  }, [children, setContent]);

  return null;
}
