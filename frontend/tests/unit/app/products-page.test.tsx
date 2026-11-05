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
    isSaving,
  }: {
    product?: { id: number };
    onSave: (input: unknown) => void;
    onClose: () => void;
    error?: string | null;
    isSaving?: boolean;
  }) => (
    <div data-testid="product-form-modal">
      <span data-testid="modal-mode">{product ? 'edit' : 'add'}</span>
      <span data-testid="modal-state">{isSaving ? 'saving' : 'idle'}</span>
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
  ConfirmDialog: ({
    onConfirm,
    onCancel,
    error,
    isConfirming,
  }: {
    onConfirm: () => void;
    onCancel: () => void;
    error?: string | null;
    isConfirming?: boolean;
  }) => (
    <div data-testid="confirm-dialog">
      {error && <span data-testid="confirm-error">{error}</span>}
      <span data-testid="confirm-state">{isConfirming ? 'busy' : 'idle'}</span>
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

let lastInvalidate: { mock: { calls: unknown[][] } };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lastInvalidate = vi.spyOn(queryClient, 'invalidateQueries');
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
    // ...and doesn't even fire the product search it was never going to show.
    expect(resolveProductSearch).not.toHaveBeenCalled();
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

  // A new product can bring a new store, and deleting one changes how many prices a store has,
  // so everything that lists or counts stores must refresh too.
  test.each([
    ['creating', async () => {
      (createProduct as ReturnType<typeof vi.fn>).mockResolvedValue(productA);
      fireEvent.click(screen.getByRole('button', { name: /add product/i }));
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
    }],
  ])('%s a product refreshes the store lists and counts', async (_label, act) => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
    await act();

    await waitFor(() => {
      const keys = lastInvalidate.mock.calls.map((c: unknown[]) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
      for (const key of [['products'], ['stores'], ['store-names'], ['store-prices-at-store'], ['store-prices-search']]) {
        expect(keys).toContain(JSON.stringify(key));
      }
    });
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

  describe('error and in-flight states', () => {
    test('a failing search shows the error, not an empty catalog', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
      renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('db down');
      expect(screen.queryByTestId('products-table')).not.toBeInTheDocument();
    });

    test('a failed delete shows its error inside the confirmation, which stays open', async () => {
      (deleteProduct as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'Product is in use' }));
      renderPage();
      await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'delete-1' }));
      fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

      expect(await screen.findByTestId('confirm-error')).toHaveTextContent('Product is in use');
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });

    test('a stale delete error is cleared when the confirmation is reopened', async () => {
      (deleteProduct as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'Product is in use' }));
      renderPage();
      await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'delete-1' }));
      fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));
      await screen.findByTestId('confirm-error');

      fireEvent.click(screen.getByRole('button', { name: 'cancel-delete' }));
      fireEvent.click(screen.getByRole('button', { name: 'delete-1' }));
      expect(screen.queryByTestId('confirm-error')).not.toBeInTheDocument();
    });

    test('the delete confirmation is marked busy while the request is in flight', async () => {
      (deleteProduct as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'delete-1' }));
      expect(screen.getByTestId('confirm-state')).toHaveTextContent('idle');
      fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));
      await waitFor(() => expect(screen.getByTestId('confirm-state')).toHaveTextContent('busy'));
    });

    test('the add form is marked saving while the create request is in flight', async () => {
      (createProduct as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /add product/i }));
      expect(screen.getByTestId('modal-state')).toHaveTextContent('idle');
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
      await waitFor(() => expect(screen.getByTestId('modal-state')).toHaveTextContent('saving'));
    });

    test('the edit form is marked saving while the update request is in flight', async () => {
      (updateProduct as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      renderPage();
      await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'edit-1' }));
      fireEvent.click(screen.getByRole('button', { name: 'save' }));
      await waitFor(() => expect(screen.getByTestId('modal-state')).toHaveTextContent('saving'));
    });
  });

  describe('search typing', () => {
    test('waits for typing to pause: only the final text is searched, not every keystroke', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Lucky Me Pancit Canton')).toBeInTheDocument());
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockClear();

      const input = screen.getByLabelText(/search products/i);
      fireEvent.change(input, { target: { value: 'c' } });
      fireEvent.change(input, { target: { value: 'co' } });
      fireEvent.change(input, { target: { value: 'coc' } });

      await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('coc'));
      expect(resolveProductSearch).toHaveBeenCalledTimes(1);
      expect(input).toHaveValue('coc');
    });
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

    test('a new search starts back at the first batch instead of staying expanded', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
      expect(shownCount()).toBe(10);

      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'product' } });
      await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('product'));
      await waitFor(() => expect(shownCount()).toBe(5));
    });

    test('changing the filter starts back at the first batch instead of staying expanded', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
      expect(shownCount()).toBe(10);

      fireEvent.click(screen.getByRole('button', { name: 'Has barcode' }));

      expect(shownCount()).toBe(5);
    });

    test('says how many of the matches are showing', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText('Product 1')).toBeInTheDocument());

      expect(screen.getByText('Showing 5 of 12')).toBeInTheDocument();
    });
  });
});
