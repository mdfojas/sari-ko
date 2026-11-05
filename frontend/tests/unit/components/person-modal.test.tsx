import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PersonModal } from '@/components/person-modal';
import type { Person } from '@/lib/persons-client';

const person: Person = {
  id: 1,
  name: 'Juan Dela Cruz',
  contact: '09171234567',
  has_account: false,
  balance: 525,
  created_at: '',
  updated_at: '',
};

function renderModal(props: Partial<React.ComponentProps<typeof PersonModal>> = {}) {
  const handlers = { onSave: vi.fn(), onDelete: vi.fn(), onCreateAccount: vi.fn(), onClose: vi.fn() };
  render(<PersonModal {...handlers} {...props} />);
  return handlers;
}

describe('PersonModal — new person', () => {
  beforeEach(() => vi.clearAllMocks());

  test('starts empty, with no delete or create-account actions', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /new person/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toHaveValue('');
    expect(screen.queryByRole('button', { name: /delete person/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
  });

  test('requires a name', () => {
    const { onSave } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/name is required/i);
  });

  test('saves the trimmed name, omitting a blank contact', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: '  Maria Santos ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Maria Santos' });
  });

  test('includes the contact when given', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/contact/i), { target: { value: ' 0918 ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Maria', contact: '0918' });
  });
});

describe('PersonModal — profile', () => {
  beforeEach(() => vi.clearAllMocks());

  test('is pre-filled and shows whether the person has an account', () => {
    renderModal({ person, hasLedgerHistory: false });
    expect(screen.getByRole('dialog', { name: /person: juan dela cruz/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Juan Dela Cruz');
    expect(screen.getByLabelText(/contact/i)).toHaveValue('09171234567');
    expect(screen.getByText(/no account/i)).toBeInTheDocument();
  });

  test('editing sends null for a cleared contact, so it can actually be cleared', () => {
    const { onSave } = renderModal({ person, hasLedgerHistory: false });
    fireEvent.change(screen.getByLabelText(/contact/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Juan Dela Cruz', contact: null });
  });

  describe('create account', () => {
    test('is offered when the person has no account', () => {
      const { onCreateAccount } = renderModal({ person, hasLedgerHistory: false });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(onCreateAccount).toHaveBeenCalledOnce();
    });

    test('is gone once the person has an account, replaced by a badge', () => {
      renderModal({ person: { ...person, has_account: true }, hasLedgerHistory: false });
      expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
      expect(screen.getByText(/has account/i)).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    test('is enabled for a person with no history and no account', () => {
      const { onDelete } = renderModal({ person, hasLedgerHistory: false });
      const del = screen.getByRole('button', { name: /delete person/i });
      expect(del).toBeEnabled();
      fireEvent.click(del);
      expect(onDelete).toHaveBeenCalledOnce();
    });

    test('is disabled, with a tooltip, once the person has any loan or payment history', () => {
      const { onDelete } = renderModal({ person, hasLedgerHistory: true });
      const del = screen.getByRole('button', { name: /delete person/i });
      expect(del).toBeDisabled();
      expect(del).toHaveAttribute('title', expect.stringMatching(/loan or payment history/i));
      fireEvent.click(del);
      expect(onDelete).not.toHaveBeenCalled();
    });

    test('is disabled, with a tooltip, while the person has a linked account', () => {
      renderModal({ person: { ...person, has_account: true }, hasLedgerHistory: false });
      const del = screen.getByRole('button', { name: /delete person/i });
      expect(del).toBeDisabled();
      expect(del).toHaveAttribute('title', expect.stringMatching(/account/i));
    });

    test('is disabled until the ledger has loaded, since history is unknown', () => {
      renderModal({ person, hasLedgerHistory: null });
      const del = screen.getByRole('button', { name: /delete person/i });
      expect(del).toBeDisabled();
      expect(del).toHaveAttribute('title', expect.stringMatching(/checking/i));
    });
  });

  test('Delete stays disabled while a save is in flight, even with no history and no account', () => {
    const { onDelete } = renderModal({ person, hasLedgerHistory: false, isSaving: true });
    const del = screen.getByRole('button', { name: /delete person/i });
    expect(del).toBeDisabled();
    fireEvent.click(del);
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('says history is unavailable, instead of "checking…" forever, when the ledger failed to load', () => {
    renderModal({ person, hasLedgerHistory: null, historyUnavailable: true });
    const del = screen.getByRole('button', { name: /delete person/i });
    expect(del).toBeDisabled();
    expect(del).toHaveAttribute('title', expect.stringMatching(/couldn.t check/i));
    expect(del).not.toHaveAttribute('title', expect.stringMatching(/checking/i));
  });

  test("shows the server's error and disables actions while busy", () => {
    const { onSave } = renderModal({ person, hasLedgerHistory: false, error: 'Person not found', isSaving: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Person not found');
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /saving/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  test('Close calls onClose', () => {
    const { onClose } = renderModal({ person, hasLedgerHistory: false });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
