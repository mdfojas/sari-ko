import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoanFormModal } from '@/components/loan-form-modal';
import { searchProducts, type Product } from '@/lib/products-client';

vi.mock('@/lib/products-client', () => ({ searchProducts: vi.fn() }));

const product = (id: number, name: string, sale_price: number): Product => ({
  id,
  name,
  other_names: [],
  barcode: null,
  sale_price,
  selected_store_price_id: null,
  original_price: null,
  selected_store_name: null,
  created_at: '',
  updated_at: '',
});

const coke = product(5, 'Coca-Cola 1.5L', 8500);

function renderModal(props: Partial<React.ComponentProps<typeof LoanFormModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LoanFormModal personName="Juan Dela Cruz" onSave={onSave} onClose={onClose} {...props} />
    </QueryClientProvider>
  );
  return { onSave, onClose };
}

const row = (n: number) => screen.getByRole('group', { name: `Line item ${n}` });

async function pickCatalogProduct(n: number, query = 'coca') {
  fireEvent.change(within(row(n)).getByLabelText(/search products/i), { target: { value: query } });
  fireEvent.click(await within(row(n)).findByRole('button', { name: /Coca-Cola 1\.5L/ }));
}

describe('LoanFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (searchProducts as ReturnType<typeof vi.fn>).mockResolvedValue([coke]);
  });

  test('starts with a single catalog line item', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: /new loan/i })).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: /line item/i })).toHaveLength(1);
    expect(within(row(1)).getByLabelText(/search products/i)).toBeInTheDocument();
  });

  test('lines can be added and removed, but the last one cannot be removed', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /remove line item 1/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /add line item/i }));
    expect(screen.getAllByRole('group', { name: /line item/i })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /remove line item 2/i }));
    expect(screen.getAllByRole('group', { name: /line item/i })).toHaveLength(1);
  });

  test('a line can be switched to freeform, showing a description and amount instead of a product search', () => {
    renderModal();
    fireEvent.click(within(row(1)).getByRole('button', { name: /freeform/i }));
    expect(within(row(1)).getByLabelText(/description/i)).toBeInTheDocument();
    expect(within(row(1)).getByLabelText(/^amount/i)).toBeInTheDocument();
    expect(within(row(1)).queryByLabelText(/search products/i)).not.toBeInTheDocument();
  });

  test('picking a catalog product computes the amount from its current sale price and quantity', async () => {
    renderModal();
    await pickCatalogProduct(1);
    expect(within(row(1)).getByText(/Coca-Cola 1\.5L/)).toBeInTheDocument();
    fireEvent.change(within(row(1)).getByLabelText(/quantity/i), { target: { value: '3' } });
    expect(within(row(1)).getByText('₱255.00')).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toHaveTextContent('₱255.00');
  });

  test('a mix of catalog and freeform lines sends product+quantity for one and description+amount for the other', async () => {
    const { onSave } = renderModal();
    await pickCatalogProduct(1);
    fireEvent.change(within(row(1)).getByLabelText(/quantity/i), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /add line item/i }));
    fireEvent.click(within(row(2)).getByRole('button', { name: /freeform/i }));
    fireEvent.change(within(row(2)).getByLabelText(/description/i), { target: { value: ' Kulang ' } });
    fireEvent.change(within(row(2)).getByLabelText(/^amount/i), { target: { value: '15.00' } });

    expect(screen.getByText(/total/i)).toHaveTextContent('₱185.00');
    fireEvent.click(screen.getByRole('button', { name: /save loan/i }));

    expect(onSave).toHaveBeenCalledWith({
      line_items: [
        { product_id: 5, quantity: 2 },
        { description: 'Kulang', amount: 1500 },
      ],
    });
  });

  test('includes an optional note', async () => {
    const { onSave } = renderModal();
    fireEvent.click(within(row(1)).getByRole('button', { name: /freeform/i }));
    fireEvent.change(within(row(1)).getByLabelText(/description/i), { target: { value: 'rice' } });
    fireEvent.change(within(row(1)).getByLabelText(/^amount/i), { target: { value: '58' } });
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: ' weekly ' } });
    fireEvent.click(screen.getByRole('button', { name: /save loan/i }));
    expect(onSave).toHaveBeenCalledWith({ note: 'weekly', line_items: [{ description: 'rice', amount: 5800 }] });
  });

  describe('validation', () => {
    test('a catalog line needs a product', () => {
      const { onSave } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: /save loan/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/choose a product for line item 1/i);
    });

    test.each(['0', '-1', '1.5', 'abc', ''])('a catalog quantity of "%s" is rejected', async (quantity) => {
      const { onSave } = renderModal();
      await pickCatalogProduct(1);
      fireEvent.change(within(row(1)).getByLabelText(/quantity/i), { target: { value: quantity } });
      fireEvent.click(screen.getByRole('button', { name: /save loan/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
    });

    test('a freeform line needs a description', () => {
      const { onSave } = renderModal();
      fireEvent.click(within(row(1)).getByRole('button', { name: /freeform/i }));
      fireEvent.change(within(row(1)).getByLabelText(/^amount/i), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /save loan/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/description for line item 1/i);
    });

    test.each(['', '0', '-3'])('a freeform amount of "%s" is rejected', (amount) => {
      const { onSave } = renderModal();
      fireEvent.click(within(row(1)).getByRole('button', { name: /freeform/i }));
      fireEvent.change(within(row(1)).getByLabelText(/description/i), { target: { value: 'x' } });
      fireEvent.change(within(row(1)).getByLabelText(/^amount/i), { target: { value: amount } });
      fireEvent.click(screen.getByRole('button', { name: /save loan/i }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/greater than ₱0/i);
    });
  });

  test("shows the server's error and locks the form while saving", () => {
    const { onSave } = renderModal({ error: 'Product 9 not found', isSaving: true });
    expect(screen.getByRole('alert')).toHaveTextContent('Product 9 not found');
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /saving/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  test('a failing product search says so instead of showing no results', async () => {
    (searchProducts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    renderModal();
    fireEvent.change(within(row(1)).getByLabelText(/search products/i), { target: { value: 'coca' } });
    expect(await within(row(1)).findByText(/couldn.t search products/i)).toBeInTheDocument();
  });

  test('Cancel calls onClose', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
