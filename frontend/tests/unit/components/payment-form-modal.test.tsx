import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentFormModal } from '@/components/payment-form-modal';

function renderModal(props: Partial<React.ComponentProps<typeof PaymentFormModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<PaymentFormModal personName="Juan Dela Cruz" balance={1725} onSave={onSave} onClose={onClose} {...props} />);
  return { onSave, onClose };
}

describe('PaymentFormModal', () => {
  beforeEach(() => vi.clearAllMocks());

  test('names the person and shows their current balance', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /record payment/i })).toBeInTheDocument();
    expect(screen.getByText(/juan dela cruz/i)).toBeInTheDocument();
    expect(screen.getByText(/₱17\.25/)).toBeInTheDocument();
  });

  test('saves the amount in centavos and an optional note', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^amount/i), { target: { value: '10.50' } });
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: ' partial ' } });
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
    expect(onSave).toHaveBeenCalledWith({ amount: 1050, note: 'partial' });
  });

  test('omits a blank note', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^amount/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
    expect(onSave).toHaveBeenCalledWith({ amount: 500 });
  });

  test.each(['', '0', '0.00', '-5'])('rejects an amount of "%s" (must be greater than ₱0)', (amount) => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^amount/i), { target: { value: amount } });
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than ₱0/i);
  });

  test("shows the server's error and disables the buttons while saving", () => {
    const { onSave } = renderModal({ error: 'amount is required', isSaving: true });
    expect(screen.getByRole('alert')).toHaveTextContent('amount is required');
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /saving/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  test('Cancel calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
