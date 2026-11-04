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

  test('wide gives a roomier panel for form-heavy dialogs', () => {
    render(
      <Modal ariaLabel="Wide dialog" wide>
        <p>content</p>
      </Modal>
    );
    expect(screen.getByText('content').parentElement?.className).toContain('w-[36rem]');
  });

  test('scrolls instead of overflowing the screen when its content is tall', () => {
    render(
      <Modal ariaLabel="Tall dialog">
        <p>content</p>
      </Modal>
    );
    expect(screen.getByText('content').parentElement?.className).toContain('overflow-y-auto');
  });
});
