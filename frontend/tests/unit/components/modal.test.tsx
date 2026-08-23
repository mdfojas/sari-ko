import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from '@/components/modal';

describe('Modal', () => {
  test('renders as a dialog with the given aria-label and its children', () => {
    render(
      <Modal ariaLabel="Test dialog">
        <p>content</p>
      </Modal>
    );

    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
