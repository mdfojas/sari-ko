import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StorePricesProductTable } from '@/components/store-prices-product-table';
import type { Product } from '@/lib/products-client';

const productA: Product = {
  id: 1,
  name: 'Lucky Me Pancit Canton',
  other_names: ['pancit canton', 'noodles'],
  barcode: '4800016600011',
  sale_price: 1500,
  selected_store_price_id: 11,
  original_price: 1200,
  selected_store_name: 'Puregold',
  created_at: '',
  updated_at: '',
};

const productB: Product = {
  id: 2,
  name: 'Loose Rice',
  other_names: [],
  barcode: null,
  sale_price: 5800,
  selected_store_price_id: null,
  original_price: null,
  selected_store_name: null,
  created_at: '',
  updated_at: '',
};

describe('StorePricesProductTable', () => {
  test('has the same columns as the Products table, minus the edit/delete actions', () => {
    render(<StorePricesProductTable products={[productA]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name',
      'Barcode',
      'Sale price',
      'Store price',
      'Selected store',
      'Aliases',
      '',
    ]);
  });

  test('renders a row per product with its barcode, prices, selected store and aliases', () => {
    render(<StorePricesProductTable products={[productA]} onSelect={vi.fn()} />);
    const row = screen.getByText('Lucky Me Pancit Canton').closest('tr') as HTMLElement;
    expect(within(row).getByText('4800016600011')).toBeInTheDocument();
    expect(within(row).getByText('₱15.00')).toBeInTheDocument();
    expect(within(row).getByText('₱12.00')).toBeInTheDocument();
    expect(within(row).getByText('Puregold')).toBeInTheDocument();
    expect(within(row).getByText('pancit canton')).toBeInTheDocument();
    expect(within(row).getByText('noodles')).toBeInTheDocument();
  });

  test('shows dashes, not NaN or blanks, for a product with no barcode and no sale-price source', () => {
    render(<StorePricesProductTable products={[productB]} onSelect={vi.fn()} />);
    const row = screen.getByText('Loose Rice').closest('tr') as HTMLElement;
    expect(within(row).getByText(/none/i)).toBeInTheDocument();
    expect(within(row).getByText('₱58.00')).toBeInTheDocument();
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(row.textContent).not.toMatch(/NaN|undefined|null/);
  });

  test('clicking the name selects the product', () => {
    const onSelect = vi.fn();
    render(<StorePricesProductTable products={[productA, productB]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Loose Rice' }));
    expect(onSelect).toHaveBeenCalledWith(productB);
  });

  test('clicking anywhere else on the row selects it too', () => {
    const onSelect = vi.fn();
    render(<StorePricesProductTable products={[productA]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('₱15.00'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(productA);
  });

  test('clicking the name button selects once, not twice (the row click must not double-fire)', () => {
    const onSelect = vi.fn();
    render(<StorePricesProductTable products={[productA]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lucky Me Pancit Canton' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('has exactly one button per row, so each product is one tab stop', () => {
    render(<StorePricesProductTable products={[productA, productB]} onSelect={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('marks an exact barcode match', () => {
    render(<StorePricesProductTable products={[productA]} exactBarcodeMatchId={1} onSelect={vi.fn()} />);
    expect(screen.getByText(/exact barcode match/i)).toBeInTheDocument();
  });
});
