import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AccountProfileModal } from '@/components/account-profile-modal';
import type { Account } from '@/lib/accounts-client';

const customer: Account = {
  id: 3,
  username: 'juandelacruz',
  role: 'customer',
  person_id: 1,
  created_at: '2026-03-15T12:00:00.000Z',
  updated_at: '2026-03-15T12:00:00.000Z',
};

function renderModal(props: Partial<React.ComponentProps<typeof AccountProfileModal>> = {}) {
  const handlers = { onReset: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  render(
    <AccountProfileModal
      account={customer}
      personName="Juan Dela Cruz"
      canManage
      isLastAdmin={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('AccountProfileModal', () => {
  beforeEach(() => vi.clearAllMocks());

  test('shows the username as plain text (not an input), the role, linked person and created date', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /account: juandelacruz/i })).toBeInTheDocument();
    expect(screen.getByText('juandelacruz', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  test('explains that usernames can only be changed by their owner', () => {
    renderModal();
    expect(screen.getByText(/only be changed by the account owner/i)).toBeInTheDocument();
  });

  test('has no linked-person row for a non-customer', () => {
    renderModal({ account: { ...customer, role: 'store_owner', person_id: null }, personName: null });
    expect(screen.queryByText(/linked person/i)).not.toBeInTheDocument();
  });

  test('Reset password and Delete call their handlers when the caller may manage the account', () => {
    const { onReset, onDelete } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  test('both actions are disabled, with an explanatory tooltip, when the caller may not manage the account', () => {
    const { onReset, onDelete } = renderModal({ canManage: false, account: { ...customer, role: 'admin' } });
    const reset = screen.getByRole('button', { name: /reset password/i });
    const del = screen.getByRole('button', { name: /delete account/i });
    expect(reset).toBeDisabled();
    expect(del).toBeDisabled();
    expect(reset).toHaveAttribute('title', expect.stringMatching(/not permitted|permission/i));
    expect(del).toHaveAttribute('title', expect.stringMatching(/not permitted|permission/i));
    fireEvent.click(del);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });

  test('deleting the last admin shows a block message instead of calling onDelete', () => {
    const { onDelete } = renderModal({ account: { ...customer, role: 'admin', person_id: null }, personName: null, isLastAdmin: true });
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/only admin/i);
  });

  test('Close calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
