'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface TopbarContextValue {
  content: ReactNode;
  setContent: (node: ReactNode) => void;
}

const TopbarContext = createContext<TopbarContextValue | null>(null);

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);

  return (
    <TopbarContext.Provider value={{ content, setContent }}>{children}</TopbarContext.Provider>
  );
}

export function useTopbar(): TopbarContextValue {
  const ctx = useContext(TopbarContext);
  if (!ctx) throw new Error('useTopbar must be used within a TopbarProvider');
  return ctx;
}
