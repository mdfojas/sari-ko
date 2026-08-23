'use client';

import type { ReactNode } from 'react';

interface ModalProps {
  ariaLabel: string;
  children: ReactNode;
  compact?: boolean;
}

// Shared overlay + panel wrapper — was hand-duplicated across
// product-form-modal.tsx, confirm-dialog.tsx, and barcode-scanner-button.tsx.
export function Modal({ ariaLabel, children, compact = false }: ModalProps) {
  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className={`w-96 rounded-lg bg-card ${compact ? 'p-5' : 'p-6'}`}>{children}</div>
    </div>
  );
}
