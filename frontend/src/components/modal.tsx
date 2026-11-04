'use client';

import type { ReactNode } from 'react';

interface ModalProps {
  ariaLabel: string;
  children: ReactNode;
  compact?: boolean;
  wide?: boolean;
}

// Shared overlay + panel wrapper — was hand-duplicated across
// product-form-modal.tsx, confirm-dialog.tsx, and barcode-scanner-button.tsx.
export function Modal({ ariaLabel, children, compact = false, wide = false }: ModalProps) {
  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        className={`max-h-[90vh] overflow-y-auto rounded-lg bg-card ${wide ? 'w-[36rem]' : 'w-96'} ${
          compact ? 'p-5' : 'p-6'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
