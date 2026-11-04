import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CredentialResultModal } from '@/components/credential-result-modal';

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('CredentialResultModal', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  test('shows the username (when given) and the password, with a shown-once warning', () => {
    render(<CredentialResultModal title="Account created" username="juan1" password="Abcd1234" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Account created' })).toBeInTheDocument();
    expect(screen.getByText('juan1')).toBeInTheDocument();
    expect(screen.getByText('Abcd1234')).toBeInTheDocument();
    expect(screen.getByText(/only once/i)).toBeInTheDocument();
  });

  test('omits the username row when none is given (e.g. a password reset)', () => {
    render(<CredentialResultModal title="Password reset" password="Abcd1234" onClose={vi.fn()} />);
    expect(screen.queryByText(/username/i)).not.toBeInTheDocument();
  });

  test('renders an optional note', () => {
    render(<CredentialResultModal title="Password reset" password="Abcd1234" note="Existing sessions stay valid." onClose={vi.fn()} />);
    expect(screen.getByText('Existing sessions stay valid.')).toBeInTheDocument();
  });

  test('copies the password to the clipboard and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<CredentialResultModal title="Account created" password="Abcd1234" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /copy password/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Abcd1234'));
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });

  test('says so if the clipboard is unavailable, instead of pretending it copied', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<CredentialResultModal title="Account created" password="Abcd1234" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /copy password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/copy it manually/i);
    expect(screen.queryByText(/^copied/i)).not.toBeInTheDocument();
  });

  test('Done calls onClose', () => {
    const onClose = vi.fn();
    render(<CredentialResultModal title="Account created" password="Abcd1234" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
