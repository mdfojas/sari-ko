'use client';

import { useTopbar } from '@/contexts/topbar-context';

export function Topbar() {
  const { content } = useTopbar();

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-7 py-4">
      {content}
    </div>
  );
}
