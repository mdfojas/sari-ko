import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductFormModal } from '@/components/product-form-modal';
import { listDistinctStoreNames } from '@/lib/store-prices-client';
import type { Product } from '@/lib/products-client';

vi.mock('@/lib/store-prices-client', () => ({ listDistinctStoreNames: vi.fn() }));
vi.mock('@/components/barcode-scanner-button', () => ({
  BarcodeScannerButton: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan('SCANNED0000001')}>stub-scan</button>
  ),
}));

const existingProduct: Product = {
  id: 1,
  name: 'Lucky Me Pancit Canton',
  other_names: ['pancit canton', 'instant noodles'],
  barcode: '4800016600011',
  sale_price: 1500,
  selected_store_price_id: 11,
  original_price: 1200,
  selected_store_name: 'Puregold',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderModal(props: Partial<React.ComponentProps<typeof ProductFormModal>> = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductFormModal onSave={vi.fn()} onClose={vi.fn()} {...props} />
    </QueryClientProvider>
  );
}

describe('ProductFormModal — add mode', () => {
  beforeEach(() => {
    (listDistinctStoreNames as ReturnType<typeof vi.fn>).mockResolvedValue(['Puregold', 'SM Supermarket']);
  });

  test('renders empty fields plus an initial store-price section', () => {
    renderModal();
    expect(screen.getByLabelText(/^name/i)).toHaveValue('');
    expect(screen.getByLabelText(/store name/i)).toBeInTheDocument();
  });

  test('offers previously-used store names as suggestions, without forcing a choice', async () => {
    renderModal();
    const input = screen.getByLabelText(/store name/i) as HTMLInputElement;
    const datalist = document.getElementById(input.getAttribute('list')!);
    await waitFor(() => expect(datalist?.querySelectorAll('option')).toHaveLength(2));

    // Still freely typeable — not restricted to the suggested list.
    fireEvent.change(input, { target: { value: 'Brand New Store' } });
    expect(input).toHaveValue('Brand New Store');
  });

  test('submitting valid input calls onSave with a CreateProductInput shape', () => {
    const onSave = vi.fn();
    renderModal({ onSave });

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'New Product' } });
    fireEvent.change(screen.getByLabelText(/barcode/i), { target: { value: '1234567890123' } });
    fireEvent.change(screen.getByLabelText(/aliases/i), { target: { value: 'alias one, alias two' } });
    fireEvent.change(screen.getByLabelText(/sale price/i), { target: { value: '21.25' } });
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'Puregold' } });
    fireEvent.change(screen.getByLabelText(/^store price/i), { target: { value: '18.00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({
      name: 'New Product',
      barcode: '1234567890123',
      other_names: ['alias one', 'alias two'],
      sale_price: 2125,
      store_prices: [{ store_name: 'Puregold', price: 1800, selected: true }],
    });
  });

  test('shows a validation error and does not call onSave when name is blank', () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText(/sale price/i), { target: { value: '10.00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  });

  test('shows a validation error and does not call onSave when sale price is zero', () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'New Product' } });
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'Puregold' } });
    fireEvent.change(screen.getByLabelText(/^store price/i), { target: { value: '18.00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/price/i);
  });

  test('shows a validation error and does not call onSave when the store name is blank', () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'New Product' } });
    fireEvent.change(screen.getByLabelText(/sale price/i), { target: { value: '10.00' } });
    fireEvent.change(screen.getByLabelText(/^store price/i), { target: { value: '18.00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/store/i);
  });

  test('shows a validation error and does not call onSave when the store price is zero', () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'New Product' } });
    fireEvent.change(screen.getByLabelText(/sale price/i), { target: { value: '10.00' } });
    fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'Puregold' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/store/i);
  });

  test('scanning a barcode fills in the barcode field', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'stub-scan' }));
    expect(screen.getByLabelText(/barcode/i)).toHaveValue('SCANNED0000001');
  });
});

describe('ProductFormModal — edit mode', () => {
  test('renders prefilled fields and no initial store-price section', () => {
    renderModal({ product: existingProduct });
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Lucky Me Pancit Canton');
    expect(screen.getByLabelText(/barcode/i)).toHaveValue('4800016600011');
    expect(screen.getByLabelText(/sale price/i)).toHaveValue('15.00');
    expect(screen.queryByLabelText(/store name/i)).not.toBeInTheDocument();
  });

  test('submitting calls onSave with an UpdateProductInput shape (no store_prices)', () => {
    const onSave = vi.fn();
    renderModal({ product: existingProduct, onSave });

    fireEvent.change(screen.getByLabelText(/sale price/i), { target: { value: '18.00' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Lucky Me Pancit Canton',
      barcode: '4800016600011',
      other_names: ['pancit canton', 'instant noodles'],
      sale_price: 1800,
    });
  });

  test('scanning a barcode overwrites the existing barcode field', () => {
    renderModal({ product: existingProduct });
    fireEvent.click(screen.getByRole('button', { name: 'stub-scan' }));
    expect(screen.getByLabelText(/barcode/i)).toHaveValue('SCANNED0000001');
  });
});

describe('ProductFormModal — shared behavior', () => {
  test('shows a server-provided error message when given one', () => {
    renderModal({ error: 'A product with this barcode already exists' });
    expect(screen.getByRole('alert')).toHaveTextContent('A product with this barcode already exists');
  });

  test('cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
