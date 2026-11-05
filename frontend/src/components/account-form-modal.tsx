'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import type { CreateAccountInput } from '@/lib/accounts-client';
import type { Role } from '@/lib/auth-types';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password-rules';
import type { Person } from '@/lib/persons-client';

interface AccountFormModalProps {
  callerRole: Role;
  persons: Person[];
  // True when the people list failed to load — so an empty picker isn't
  // mistaken for "everyone already has an account".
  personsUnavailable?: boolean;
  onSave: (input: CreateAccountInput) => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

const ROLE_LABELS: Record<Role, string> = { customer: 'Customer', store_owner: 'Store owner', admin: 'Admin' };

export function AccountFormModal({
  callerRole,
  persons,
  personsUnavailable = false,
  onSave,
  onClose,
  error,
  isSaving = false,
}: AccountFormModalProps) {
  // Mirrors the backend matrix: an admin can create any role, a store_owner
  // customers only. Customer is listed first (and is the default) as the
  // least-privileged choice.
  const creatableRoles: Role[] = callerRole === 'admin' ? ['customer', 'store_owner', 'admin'] : ['customer'];
  const [role, setRole] = useState<Role>('customer');
  const [personId, setPersonId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isCustomer = role === 'customer';
  const availablePersons = persons.filter((p) => !p.has_account);

  function handleSubmit() {
    if (isSaving) return;
    const trimmedUsername = username.trim();

    if (isCustomer && !personId) {
      setValidationError('Choose the person this account is for.');
      return;
    }
    if (!isCustomer && !trimmedUsername) {
      setValidationError('Username is required for admin and store owner accounts.');
      return;
    }
    if (password !== '' && !isValidPassword(password)) {
      setValidationError(PASSWORD_RULE_MESSAGE);
      return;
    }
    setValidationError(null);

    const input: CreateAccountInput = { role };
    if (isCustomer) input.person_id = Number(personId);
    if (trimmedUsername) input.username = trimmedUsername;
    if (password !== '') input.password = password;
    onSave(input);
  }

  return (
    <Modal ariaLabel="Create account">
      <h3 className="mb-4 text-base font-bold text-text">Create account</h3>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="af-role" className="mb-1 block text-xs font-semibold text-text-muted">
          Role
        </label>
        <select
          id="af-role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role);
            setValidationError(null);
          }}
          className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-text"
        >
          {creatableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {isCustomer && (
        <div className="mb-3">
          <label htmlFor="af-person" className="mb-1 block text-xs font-semibold text-text-muted">
            Person
          </label>
          {personsUnavailable ? (
            <p className="text-sm text-danger">Couldn&apos;t load the list of people. Close this and try again.</p>
          ) : availablePersons.length === 0 ? (
            <p className="text-sm text-text-muted">
              Every person already has an account. Add a new person first, then create their account.
            </p>
          ) : (
            <select
              id="af-person"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-text"
            >
              <option value="">Choose a person…</option>
              {availablePersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="af-username" className="mb-1 block text-xs font-semibold text-text-muted">
          {isCustomer ? 'Username (optional — generated from the person’s name)' : 'Username'}
        </label>
        <input
          id="af-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="af-password" className="mb-1 block text-xs font-semibold text-text-muted">
          Password (optional — generated if blank)
        </label>
        <input
          id="af-password"
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
        <p className="mt-1 text-xs text-text-muted">8–16 characters.</p>
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
          {isSaving ? 'Creating…' : 'Create account'}
        </button>
      </div>
    </Modal>
  );
}
