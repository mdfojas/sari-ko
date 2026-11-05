'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { parsePesoInput, peso } from '@/lib/money';
import type { PaymentInput } from '@/lib/payments-client';

interface PaymentFormModalProps {
  personName: string;
  balance: number;
  onSave: (input: PaymentInput) => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

export function PaymentFormModal({ personName, balance, onSave, onClose, error, isSaving = false }: PaymentFormModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (isSaving) return;
    const centavos = parsePesoInput(amount);
    if (centavos === null || centavos <= 0) {
      setValidationError('Amount must be greater than ₱0 and at most ₱21,474,836.47, like 10.50.');
      return;
    }
    setValidationError(null);
    const input: PaymentInput = { amount: centavos };
    if (note.trim()) input.note = note.trim();
    onSave(input);
  }

  return (
    <Modal ariaLabel="Record payment">
      <h3 className="mb-2 text-base font-bold text-text">Record payment</h3>
      <p className="mb-4 text-sm text-text-muted">
        Payment from <strong className="text-text">{personName}</strong>. Current balance: {peso(balance)}
      </p>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="pay-amount" className="mb-1 block text-xs font-semibold text-text-muted">
          Amount (₱)
        </label>
        <input
          id="pay-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 10.50"
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="pay-note" className="mb-1 block text-xs font-semibold text-text-muted">
          Note (optional)
        </label>
        <input
          id="pay-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </Modal>
  );
}
