'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password-rules';

interface ResetPasswordModalProps {
  username: string;
  // `undefined` means "generate one for me".
  onReset: (password: string | undefined) => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

export function ResetPasswordModal({ username, onReset, onClose, error, isSaving = false }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (isSaving) return;
    if (password !== '' && !isValidPassword(password)) {
      setValidationError(PASSWORD_RULE_MESSAGE);
      return;
    }
    setValidationError(null);
    onReset(password === '' ? undefined : password);
  }

  return (
    <Modal ariaLabel="Reset password">
      <h3 className="mb-2 text-base font-bold text-text">Reset password</h3>
      <p className="mb-4 text-sm text-text-muted">
        Set a new password for <strong className="text-text">{username}</strong>.
      </p>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="rp-password" className="mb-1 block text-xs font-semibold text-text-muted">
          New password (optional — generated if blank)
        </label>
        <input
          id="rp-password"
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
        <p className="mt-1 text-xs text-text-muted">8–16 characters.</p>
      </div>

      <p className="mb-3 text-xs text-text-muted">
        Existing sessions stay valid until they expire naturally — a password reset does not sign anyone out.
      </p>

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
          {isSaving ? 'Resetting…' : 'Reset password'}
        </button>
      </div>
    </Modal>
  );
}
