import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AccountFormModal } from '@/components/account-form-modal';
import type { Person } from '@/lib/persons-client';

const person = (id: number, name: string, has_account = false): Person => ({
  id,
  name,
  contact: null,
  has_account,
  created_at: '',
  updated_at: '',
});

const persons = [person(1, 'Juan Dela Cruz'), person(2, 'Maria Santos', true), person(3, 'Pedro Reyes')];

function renderModal(props: Partial<React.ComponentProps<typeof AccountFormModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<AccountFormModal callerRole="admin" persons={persons} onSave={onSave} onClose={onClose} {...props} />);
  return { onSave, onClose };
}

const roleOptions = () => within(screen.getByLabelText(/^role$/i)).getAllByRole('option').map((o) => o.textContent);

describe('AccountFormModal', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('which roles can be created', () => {
    test('an admin can create admin, store_owner and customer accounts', () => {
      renderModal({ callerRole: 'admin' });
      expect(roleOptions()).toEqual(['Customer', 'Store owner', 'Admin']);
    });

    test('a store_owner can only create customers', () => {
      renderModal({ callerRole: 'store_owner' });
      expect(roleOptions()).toEqual(['Customer']);
    });
  });

  describe('customer accounts', () => {
    test('default to customer and offer only people who do not have an account yet', () => {
      renderModal();
      expect(screen.getByLabelText(/^role$/i)).toHaveValue('customer');
      const options = within(screen.getByLabelText(/^person$/i)).getAllByRole('option').map((o) => o.textContent);
      expect(options).toContain('Juan Dela Cruz');
      expect(options).toContain('Pedro Reyes');
      expect(options).not.toContain('Maria Santos');
    });

    test('require a person', () => {
      const { onSave } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/choose the person/i);
    });

    test('send person_id only, letting the backend generate the username and password', () => {
      const { onSave } = renderModal();
      fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(onSave).toHaveBeenCalledWith({ role: 'customer', person_id: 3 });
    });

    test('accept an explicit username and password', () => {
      const { onSave } = renderModal();
      fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: ' juan1 ' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secret1234' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(onSave).toHaveBeenCalledWith({ role: 'customer', person_id: 1, username: 'juan1', password: 'secret1234' });
    });

    test("say so, rather than claiming everyone has an account, when the people list couldn't be loaded", () => {
      renderModal({ persons: [], personsUnavailable: true });
      expect(screen.queryByText(/every person already has an account/i)).not.toBeInTheDocument();
      expect(screen.getByText(/couldn.t load the list of people/i)).toBeInTheDocument();
    });

    test('explain when everyone already has an account', () => {
      renderModal({ persons: [person(2, 'Maria Santos', true)] });
      expect(screen.getByText(/every person already has an account/i)).toBeInTheDocument();
    });
  });

  describe('admin and store_owner accounts', () => {
    test('hide the person picker and require a username', () => {
      const { onSave } = renderModal();
      fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'store_owner' } });
      expect(screen.queryByLabelText(/^person$/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/username is required/i);
    });

    test('send the role and username, without a person_id', () => {
      const { onSave } = renderModal();
      fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
      fireEvent.change(screen.getByLabelText(/^username/i), { target: { value: 'boss' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      expect(onSave).toHaveBeenCalledWith({ role: 'admin', username: 'boss' });
    });
  });

  test.each(['short', 'this-password-is-way-too-long'])('rejects the explicit password "%s" (needs 8-16 characters)', (password) => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/between 8 and 16/i);
  });

  test("shows the server's error, e.g. a duplicate username, in the open form", () => {
    renderModal({ error: 'An account with this username already exists' });
    expect(screen.getByRole('alert')).toHaveTextContent('An account with this username already exists');
  });

  test('disables the buttons and relabels the submit while saving', () => {
    const { onSave } = renderModal({ isSaving: true });
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /creating/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  test('Cancel calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
