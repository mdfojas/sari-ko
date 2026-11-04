'use client';

import { Modal } from './modal';

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  error?: string | null;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  danger = true,
  error = null,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal ariaLabel={title}>
      <h3 className="mb-2 text-base font-bold text-text">{title}</h3>
      <p className="mb-5 text-sm text-text-muted">{body}</p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className={`rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            danger ? 'bg-danger' : 'bg-accent'
          }`}
        >
          {isConfirming ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
