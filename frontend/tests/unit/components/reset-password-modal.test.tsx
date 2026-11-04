import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResetPasswordModal } from '@/components/reset-password-modal';

function renderModal(props: Partial<React.ComponentProps<typeof ResetPasswordModal>> = {}) {
  const onReset = vi.fn();
  const onClose = vi.fn();
  render(<ResetPasswordModal username="juandelacruz" onReset={onReset} onClose={onClose} {...props} />);
  return { onReset, onClose };
}

describe('ResetPasswordModal', () => {
  beforeEach(() => vi.clearAllMocks());

  test('names the account being reset and notes that existing sessions stay valid', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /reset password/i })).toBeInTheDocument();
    expect(screen.getByText(/juandelacruz/)).toBeInTheDocument();
    expect(screen.getByText(/existing sessions/i)).toBeInTheDocument();
  });

  test('with the field left blank, asks for an auto-generated password', () => {
    const { onReset } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^reset password$/i }));
    expect(onReset).toHaveBeenCalledWith(undefined);
  });

  test('sends an explicit password when one is typed', () => {
    const { onReset } = renderModal();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'newpass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /^reset password$/i }));
    expect(onReset).toHaveBeenCalledWith('newpass1234');
  });

  test.each(['short', 'this-password-is-way-too-long'])('rejects "%s" (needs 8-16 characters)', (password) => {
    const { onReset } = renderModal();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /^reset password$/i }));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/between 8 and 16/i);
  });

  test("shows the server's error in the open form", () => {
    renderModal({ error: 'Forbidden' });
    expect(screen.getByRole('alert')).toHaveTextContent('Forbidden');
  });

  test('disables the buttons and relabels the submit while resetting', () => {
    const { onReset } = renderModal({ isSaving: true });
    expect(screen.getByRole('button', { name: /resetting/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /resetting/i }));
    expect(onReset).not.toHaveBeenCalled();
  });

  test('Cancel calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
