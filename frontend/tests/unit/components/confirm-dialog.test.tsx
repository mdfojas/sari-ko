import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from '@/components/confirm-dialog';

describe('ConfirmDialog', () => {
  test('renders the title and body', () => {
    render(
      <ConfirmDialog
        title="Delete this product?"
        body="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete this product?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  test('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog title="t" body="b" confirmLabel="Delete Product" onConfirm={onConfirm} onCancel={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Product' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  test('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="t" body="b" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('defaults the confirm button label to "Delete"', () => {
    render(<ConfirmDialog title="t" body="b" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  test('shows an error message as an alert, leaving the dialog open for another try', () => {
    render(<ConfirmDialog title="t" body="b" error="Product is in use" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Product is in use');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  test('shows no alert when there is no error', () => {
    render(<ConfirmDialog title="t" body="b" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('while confirming, disables both buttons, relabels the confirm button, and ignores clicks', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog title="t" body="b" isConfirming onConfirm={onConfirm} onCancel={onCancel} />);

    const confirm = screen.getByRole('button', { name: /working/i });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    fireEvent.click(confirm);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
