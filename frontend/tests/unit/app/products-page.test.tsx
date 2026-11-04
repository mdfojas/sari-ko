import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import ProductsPage from '@/app/(app)/products/page';
import { resolveProductSearch } from '@/lib/product-search';
import { createProduct, deleteProduct, updateProduct } from '@/lib/products-client';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';

const replace = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/product-search', () => ({ resolveProductSearch: vi.fn() }));
vi.mock('@/lib/products-client', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock('@/components/products-table', () => ({
  ProductsTable: ({
    products,
    onEdit,
    onDelete,
  }: {
    products: { id: number; name: string }[];
    onEdit: (p: { id: number; name: string }) => void;
    onDelete: (p: { id: number; name: string }) => void;
  }) => (
    <div data-testid="products-table">
      {products.map((p) => (
        <div key={p.id}>
          <span>{p.name}</span>
          <button onClick={() => onEdit(p)}>{`edit-${p.id}`}</button>
          <button onClick={() => onDelete(p)}>{`delete-${p.id}`}</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/product-form-modal', () => ({
  ProductFormModal: ({
    product,
    onSave,
    onClose,
    error,
  }: {
    product?: { id: number };
    onSave: (input: unknown) => void;
    onClose: () => void;
    error?: string | null;
  }) => (
    <div data-testid="product-form-modal">
      <span data-testid="modal-mode">{product ? 'edit' : 'add'}</span>
      {error && <span data-testid="modal-error">{error}</span>}
      <button
        onClick={() =>
          onSave(
            product
              ? { name: 'Updated Name' }
              : { name: 'New Product', store_prices: [{ store_name: 'X', price: 100, selected: true }] }
          )
        }
      >
        save
      </button>
      <button onClick={onClose}>cancel-form</button>
    </div>
  ),
}));

vi.mock('@/components/confirm-dialog', () => ({
  ConfirmDialog: ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="confirm-dialog">
      <button onClick={onConfirm}>confirm-delete</button>
      <button onClick={onCancel}>cancel-delete</button>
    </div>
  ),
}));

vi.mock('@/components/barcode-scanner-button', () => ({
  BarcodeScannerButton: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan('4800016600011')}>stub-scan</button>
  ),
}));

const productA = {
  id: 1,
  name: 'Lucky Me Pancit Canton',
  other_names: [],
  barcode: '4800016600011',
  sale_price: 1500,
  selected_store_price_id: 11,
  original_price: 1200,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TopbarProvider>
        <Topbar />
        <ProductsPage />
      </TopbarProvider>
    </QueryClientProvider>
  );
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
      matches: [productA],
      exact: null,
    });
  });

  test('redirects a customer away and renders nothing', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 3, username: 'juan1', role: 'customer', personId: 1 },
      isLoading: false,
    });
    renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/my-ledger'));
    expect(screen.queryByText('Lucky Me Pancit Canton')).not.toBeInTheDocument();
  });

  test('renders normally for a store_owner', async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 2, username: 'owner1', role: 'store_owner', personId: null },
      isLoading: false,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  test('loads and displays products on mount', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
    expect(resolveProductSearch).toHaveBeenCalledWith('');
  });

  test('typing in the search box re-queries with the new text', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'pancit' } });

    await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('pancit'));
  });

  test('scanning a barcode populates the search box and re-queries with it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'stub-scan' }));

    await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('4800016600011'));
    expect(screen.getByLabelText(/search products/i)).toHaveValue('4800016600011');
  });

  test('opens the add-product modal in add mode', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));

    expect(screen.getByTestId('modal-mode')).toHaveTextContent('add');
  });

  test('saving the add-product form calls createProduct and closes the modal on success', async () => {
    (createProduct as ReturnType<typeof vi.fn>).mockResolvedValue(productA);
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(createProduct).toHaveBeenCalledWith({
      name: 'New Product',
      store_prices: [{ store_name: 'X', price: 100, selected: true }],
    }));
    await waitFor(() => expect(screen.queryByTestId('product-form-modal')).not.toBeInTheDocument());
  });

  test('a duplicate-barcode 409 shows the error inside the still-open modal instead of crashing', async () => {
    (createProduct as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(409, { error: 'A product with this barcode already exists' })
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add product/i }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(screen.getByTestId('modal-error')).toHaveTextContent('A product with this barcode already exists')
    );
    expect(screen.getByTestId('product-form-modal')).toBeInTheDocument();
  });

  test('editing a product opens the modal in edit mode and saves via updateProduct', async () => {
    (updateProduct as ReturnType<typeof vi.fn>).mockResolvedValue(productA);
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'edit-1' }));
    expect(screen.getByTestId('modal-mode')).toHaveTextContent('edit');

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith(1, { name: 'Updated Name' }));
  });

  test('deleting a product opens a confirmation, and confirming calls deleteProduct', async () => {
    (deleteProduct as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'delete-1' }));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
  });

  test('cancelling the delete confirmation does not call deleteProduct', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'delete-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel-delete' }));

    expect(deleteProduct).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  describe('paging', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...productA,
      id: i + 1,
      name: `Product ${i + 1}`,
      barcode: `48000166${String(i).padStart(5, '0')}`,
    }));

    beforeEach(() => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: many, exact: null });
    });

    const shownCount = () => screen.getAllByRole('button', { name: /^edit-/ }).length;

    test('shows 5 results by default with a "Load 5 more" button', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());

      expect(shownCount()).toBe(5);
      expect(screen.getByRole('button', { name: 'Load 5 more' })).toBeInTheDocument();
    });

    test('clicking Load more reveals the next batch', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));

      expect(shownCount()).toBe(10);
      expect(screen.getByRole('button', { name: 'Load 2 more' })).toBeInTheDocument();
    });

    test('choosing a larger batch size shows that many and loads that many more', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/results per load/i), { target: { value: '10' } });

      expect(shownCount()).toBe(10);
      expect(screen.getByRole('button', { name: 'Load 2 more' })).toBeInTheDocument();
    });

    test('hides the Load more button once everything is shown', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/results per load/i), { target: { value: '25' } });

      expect(shownCount()).toBe(12);
      expect(screen.queryByRole('button', { name: /^Load \d+ more$/ })).not.toBeInTheDocument();
    });

    test('says how many of the matches are showing', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());

      expect(screen.getByText('Showing 5 of 12')).toBeInTheDocument();
    });
  });
});
