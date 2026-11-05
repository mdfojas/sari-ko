'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';

interface CredentialResultModalProps {
  title: string;
  username?: string;
  password: string;
  note?: string;
  onClose: () => void;
}

// The backend only ever returns a plaintext password once (on account
// creation or a reset), so this is the user's single chance to record it.
export function CredentialResultModal({ title, username, password, note, onClose }: CredentialResultModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <Modal ariaLabel={title}>
      <h3 className="mb-2 text-base font-bold text-text">{title}</h3>
      <p className="mb-4 text-sm text-text-muted">This password is shown only once. Copy it now.</p>

      {username && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold text-text-muted">Username</p>
          <p className="text-sm font-semibold text-text">{username}</p>
        </div>
      )}

      <div className="mb-3">
        <p className="mb-1 text-xs font-semibold text-text-muted">Password</p>
        <div className="flex items-center gap-2">
          <code className="rounded border border-border bg-bg px-3 py-2 text-sm text-text">{password}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-text"
          >
            Copy password
          </button>
        </div>
        {copyState === 'copied' && <p className="mt-1 text-xs text-accent-dark">Copied to clipboard.</p>}
        {copyState === 'failed' && (
          <p role="alert" className="mt-1 text-xs text-danger">
            Couldn&apos;t copy automatically — select the password and copy it manually.
          </p>
        )}
      </div>

      {note && <p className="mb-3 text-xs text-text-muted">{note}</p>}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
          Done
        </button>
      </div>
    </Modal>
  );
}
