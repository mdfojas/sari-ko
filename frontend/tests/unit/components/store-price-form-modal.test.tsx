import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StorePriceFormModal } from '@/components/store-price-form-modal';
import { listDistinctStoreNames, type StorePrice } from '@/lib/store-prices-client';

vi.mock('@/lib/store-prices-client', () => ({ listDistinctStoreNames: vi.fn() }));

const existing: StorePrice = {
  id: 11,
  product_id: 1,
  store_name: 'Puregold',
  price: 1200,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderModal(props: Partial<React.ComponentProps<typeof StorePriceFormModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StorePriceFormModal onSave={onSave} onClose={onClose} {...props} />
    </QueryClientProvider>
  );
  return { onSave, onClose };
}

describe('StorePriceFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listDistinctStoreNames as ReturnType<typeof vi.fn>).mockResolvedValue(['Puregold', 'S&R']);
  });

  test('add mode starts with empty fields', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /add store price/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/store name/i)).toHaveValue('');
    expect(screen.getByLabelText(/^price \(/i)).toHaveValue('');
  });

  test('edit mode is pre-filled, with the price shown in pesos', () => {
    renderModal({ storePrice: existing });
    expect(screen.getByRole('dialog', { name: /edit store price/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/store name/i)).toHaveValue('Puregold');
    expect(screen.getByLabelText(/^price \(/i)).toHaveValue('12.00');
  });

  test('suggests previously-used store names without forcing a choice', async () => {
    renderModal();
    await waitFor(() => expect(document.querySelectorAll('datalist option')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'A brand new store' } });
    expect(screen.getByLabelText(/store name/i)).toHaveValue('A brand new store');
  });

  test('saves the trimmed store name and the price converted to centavos', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: '  7-Eleven ' } });
    fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '21.25' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith({ store_name: '7-Eleven', price: 2125 });
  });

  test('rejects a blank store name', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/store name is required/i);
  });

  test.each(['', '0', '0.00', '-3'])('rejects a price of "%s" (must be greater than ₱0)', (price) => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'Puregold' } });
    fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: price } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than ₱0/i);
  });

  test.each(['1,5', '1e3', 'abc', '21474836.48', '30000000'])(
    'rejects the price "%s" rather than silently misreading it or sending an amount the database cannot hold',
    (price) => {
      const { onSave } = renderModal();
      fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'Puregold' } });
      fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: price } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/greater than ₱0.*₱21,474,836\.47/i);
    }
  );

  test('accepts thousands separators and the largest amount the database can hold', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'Puregold' } });
    fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '1,234.50' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenLastCalledWith({ store_name: 'Puregold', price: 123450 });

    fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '21474836.47' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenLastCalledWith({ store_name: 'Puregold', price: 2147483647 });
  });

  test('prefills a price with cents exactly (1205 centavos -> 12.05)', () => {
    renderModal({ storePrice: { ...existing, price: 1205 } });
    expect(screen.getByLabelText(/^price \(/i)).toHaveValue('12.05');
  });

  test('shows a server error passed in by the page', () => {
    renderModal({ error: 'Store price not found' });
    expect(screen.getByRole('alert')).toHaveTextContent('Store price not found');
  });

  test('disables Save and Cancel and relabels Save while saving', () => {
    const { onSave } = renderModal({ isSaving: true });
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
