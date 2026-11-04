'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { RoleBadge } from '@/components/role-badge';
import type { Account } from '@/lib/accounts-client';

const NOT_PERMITTED_HINT = 'You do not have permission to manage this account.';
const LAST_ADMIN_MESSAGE =
  'This is the only admin account, so it cannot be deleted — the store would be locked out of account management. Create another admin first.';

interface AccountProfileModalProps {
  account: Account;
  personName: string | null;
  canManage: boolean;
  isLastAdmin: boolean;
  onReset: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function AccountProfileModal({
  account,
  personName,
  canManage,
  isLastAdmin,
  onReset,
  onDelete,
  onClose,
}: AccountProfileModalProps) {
  const [blocked, setBlocked] = useState(false);

  function handleDelete() {
    if (isLastAdmin) {
      setBlocked(true);
      return;
    }
    onDelete();
  }

  return (
    <Modal ariaLabel={`Account: ${account.username}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-text">Account</h3>
        <RoleBadge role={account.role} />
      </div>

      <div className="mb-3">
        <p className="mb-1 text-xs font-semibold text-text-muted">Username</p>
        <p className="text-sm font-semibold text-text">{account.username}</p>
        <p className="mt-1 text-xs text-text-muted">
          Usernames can only be changed by the account owner, from their own profile.
        </p>
      </div>

      {account.role === 'customer' && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold text-text-muted">Linked person</p>
          <p className="text-sm text-text">{personName ?? '—'}</p>
        </div>
      )}

      <div className="mb-3">
        <p className="mb-1 text-xs font-semibold text-text-muted">Created</p>
        <p className="text-sm text-text">
          {new Date(account.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {blocked && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {LAST_ADMIN_MESSAGE}
        </p>
      )}

      <div className="mt-4 flex justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={!canManage}
            title={canManage ? undefined : NOT_PERMITTED_HINT}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset password
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canManage}
            title={canManage ? undefined : NOT_PERMITTED_HINT}
            className="rounded-md border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete account
          </button>
        </div>
        <button type="button" onClick={onClose} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
          Close
        </button>
      </div>
    </Modal>
  );
}
