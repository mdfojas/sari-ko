'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import type { Person, PersonInput } from '@/lib/persons-client';

const HISTORY_HINT = "This person has loan or payment history, so they can't be deleted.";
const ACCOUNT_HINT = 'This person has a linked account. Delete the account first.';
const CHECKING_HINT = 'Checking loan history…';
const UNAVAILABLE_HINT = "Couldn't check this person's loan history, so deleting is unavailable. Close and reopen to retry.";

interface PersonModalProps {
  // Present: the person's profile (edit, delete, create account). Absent: "New person".
  person?: Person;
  // null while the ledger is still loading — history is unknown, so deleting stays disabled.
  hasLedgerHistory?: boolean | null;
  // The ledger failed to load: history stays unknown, and saying "checking…" forever would be wrong.
  historyUnavailable?: boolean;
  onSave: (input: PersonInput) => void;
  onDelete?: () => void;
  onCreateAccount?: () => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

export function PersonModal({
  person,
  hasLedgerHistory = false,
  historyUnavailable = false,
  onSave,
  onDelete,
  onCreateAccount,
  onClose,
  error,
  isSaving = false,
}: PersonModalProps) {
  const isProfile = Boolean(person);
  const [name, setName] = useState(person?.name ?? '');
  const [contact, setContact] = useState(person?.contact ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSave() {
    if (isSaving) return;
    if (!name.trim()) {
      setValidationError('Name is required.');
      return;
    }
    setValidationError(null);
    const trimmedContact = contact.trim();
    const input: PersonInput = { name: name.trim() };
    // Editing sends null so a contact can actually be cleared; creating just omits it.
    if (trimmedContact) input.contact = trimmedContact;
    else if (isProfile) input.contact = null;
    onSave(input);
  }

  let deleteHint: string | undefined;
  if (historyUnavailable) deleteHint = UNAVAILABLE_HINT;
  else if (hasLedgerHistory === null) deleteHint = CHECKING_HINT;
  else if (hasLedgerHistory) deleteHint = HISTORY_HINT;
  else if (person?.has_account) deleteHint = ACCOUNT_HINT;

  return (
    <Modal ariaLabel={person ? `Person: ${person.name}` : 'New person'}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-text">{person ? 'Person' : 'New person'}</h3>
        {person && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              person.has_account ? 'bg-accent text-white' : 'border border-border text-text-muted'
            }`}
          >
            {person.has_account ? 'Has account' : 'No account'}
          </span>
        )}
      </div>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="pm-name" className="mb-1 block text-xs font-semibold text-text-muted">
          Name
        </label>
        <input
          id="pm-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="pm-contact" className="mb-1 block text-xs font-semibold text-text-muted">
          Contact (optional)
        </label>
        <input
          id="pm-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      {person && !person.has_account && onCreateAccount && (
        <button
          type="button"
          onClick={onCreateAccount}
          disabled={isSaving}
          className="mb-3 rounded-md border border-border px-3 py-2 text-xs font-semibold text-accent-dark disabled:opacity-50"
        >
          + Create account
        </button>
      )}

      <div className="mt-4 flex justify-between gap-2">
        {person ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={Boolean(deleteHint) || isSaving}
            title={deleteHint}
            className="rounded-md border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete person
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text disabled:opacity-50"
          >
            {person ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
