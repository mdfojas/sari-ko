import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductsTable } from '@/components/products-table';
import type { Product } from '@/lib/products-client';

const productA: Product = {
  id: 1,
  name: 'Lucky Me Pancit Canton',
  other_names: ['pancit canton'],
  barcode: '4800016600011',
  sale_price: 1500,
  selected_store_price_id: 11,
  original_price: 1200,
  selected_store_name: 'Puregold',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const productB: Product = {
  id: 2,
  name: 'Kopiko 3-in-1',
  other_names: [],
  barcode: null,
  sale_price: 900,
  selected_store_price_id: 41,
  original_price: 750,
  selected_store_name: 'Local wet market',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('ProductsTable', () => {
  test('renders a row per product with name, barcode, price, and aliases', () => {
    render(<ProductsTable products={[productA]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument();
    expect(screen.getByText('4800016600011')).toBeInTheDocument();
    expect(screen.getByText('₱15.00')).toBeInTheDocument();
    expect(screen.getByText('pancit canton')).toBeInTheDocument();
    expect(screen.getByText('₱12.00')).toBeInTheDocument();
    expect(screen.getByText('Puregold')).toBeInTheDocument();
  });

  test('shows a placeholder for a product with no barcode', () => {
    render(<ProductsTable products={[productB]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('— none —')).toBeInTheDocument();
  });

  test('shows an exact-match badge only for the product matching exactBarcodeMatchId', () => {
    render(
      <ProductsTable
        products={[productA, productB]}
        exactBarcodeMatchId={productA.id}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('row');
    // header + 2 data rows
    expect(rows).toHaveLength(3);
    expect(screen.getByText(/exact barcode match/i)).toBeInTheDocument();
  });

  test('calls onEdit with the product when its edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<ProductsTable products={[productA]} onEdit={onEdit} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(productA);
  });

  test('calls onDelete with the product when its delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<ProductsTable products={[productA]} onEdit={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(productA);
  });

  test('shows an empty-state message when there are no products', () => {
    render(<ProductsTable products={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/no products/i)).toBeInTheDocument();
  });
});
