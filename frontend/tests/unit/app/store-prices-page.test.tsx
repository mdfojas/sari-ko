import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import StorePricesPage from '@/app/(app)/store-prices/page';
import { useAuth } from '@/contexts/auth-context';
import { resolveProductSearch } from '@/lib/product-search';
import { getProduct, updateProduct, type Product } from '@/lib/products-client';
import {
  createStorePrice,
  deleteStorePrice,
  listDistinctStoreNames,
  listStorePrices,
  updateStorePrice,
  type StorePrice,
} from '@/lib/store-prices-client';
import { ApiError } from '@/lib/api-client';

const replace = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/product-search', () => ({ resolveProductSearch: vi.fn() }));
vi.mock('@/lib/products-client', () => ({ getProduct: vi.fn(), updateProduct: vi.fn() }));
vi.mock('@/lib/store-prices-client', () => ({
  listStorePrices: vi.fn(),
  createStorePrice: vi.fn(),
  updateStorePrice: vi.fn(),
  deleteStorePrice: vi.fn(),
  listDistinctStoreNames: vi.fn(),
}));
vi.mock('@/components/barcode-scanner-button', () => ({
  BarcodeScannerButton: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan('4800361500017')}>stub-scan</button>
  ),
}));

const product: Product = {
  id: 1,
  name: 'Coca-Cola 1.5L',
  other_names: [],
  barcode: '4800361500017',
  sale_price: 8500,
  selected_store_price_id: 3,
  original_price: 6500,
  selected_store_name: 'Puregold',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const storePrices: StorePrice[] = [
  { id: 2, product_id: 1, store_name: 'SM Supermarket', price: 7000, created_at: '', updated_at: '' },
  { id: 3, product_id: 1, store_name: 'Puregold', price: 6500, created_at: '', updated_at: '' },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <TopbarProvider>
        <Topbar />
        <StorePricesPage />
      </TopbarProvider>
    </QueryClientProvider>
  );
  return { invalidate };
}

async function openDetail() {
  fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coca' } });
  fireEvent.click(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ }));
  await screen.findByRole('heading', { name: 'Coca-Cola 1.5L' });
}

describe('StorePricesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', personId: null },
      isLoading: false,
    });
    (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [product], exact: null });
    (getProduct as ReturnType<typeof vi.fn>).mockResolvedValue(product);
    (listStorePrices as ReturnType<typeof vi.fn>).mockResolvedValue(storePrices);
    (listDistinctStoreNames as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  describe('access', () => {
    test('redirects a customer away and renders nothing', async () => {
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        user: { id: 3, username: 'juan', role: 'customer', personId: 1 },
        isLoading: false,
      });
      renderPage();
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/my-ledger'));
      expect(screen.queryByLabelText(/search products/i)).not.toBeInTheDocument();
    });

    test('renders for a store_owner', () => {
      (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        user: { id: 2, username: 'owner', role: 'store_owner', personId: null },
        isLoading: false,
      });
      renderPage();
      expect(screen.getByLabelText(/search products/i)).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });

  describe('search-first flow', () => {
    test('shows a prompt, and no product list, until something is searched', () => {
      renderPage();
      expect(screen.getByText(/search for a product/i)).toBeInTheDocument();
      expect(resolveProductSearch).not.toHaveBeenCalled();
    });

    test('searching by name lists the matching products', async () => {
      renderPage();
      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coca' } });
      expect(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ })).toBeInTheDocument();
      expect(resolveProductSearch).toHaveBeenCalledWith('coca');
    });

    test('scanning a barcode searches for it and resolves to the single matching product', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [product], exact: product });
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'stub-scan' }));
      expect(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ })).toBeInTheDocument();
      expect(resolveProductSearch).toHaveBeenCalledWith('4800361500017');
      expect(screen.getAllByRole('button', { name: /Coca-Cola/ })).toHaveLength(1);
    });

    test('says so when nothing matches', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [], exact: null });
      renderPage();
      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'zzz' } });
      expect(await screen.findByText(/no products match/i)).toBeInTheDocument();
    });

    test('a failing search shows the error, not an empty result', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      renderPage();
      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coca' } });
      expect(await screen.findByRole('alert')).toHaveTextContent('boom');
      expect(screen.queryByText(/no products match/i)).not.toBeInTheDocument();
    });
  });

  describe('detail view', () => {
    test('selecting a product switches to a detail view listing its store prices', async () => {
      renderPage();
      await openDetail();
      expect(listStorePrices).toHaveBeenCalledWith(1);
      expect(await screen.findByText('SM Supermarket')).toBeInTheDocument();
      expect(screen.getByText('₱70.00')).toBeInTheDocument();
      expect(screen.getByText('Puregold')).toBeInTheDocument();
      expect(screen.queryByLabelText(/search products/i)).not.toBeInTheDocument();
    });

    test('"Back to search" returns to the search with the previous query kept', async () => {
      renderPage();
      await openDetail();
      fireEvent.click(screen.getByRole('button', { name: /back to search/i }));
      expect(screen.getByLabelText(/search products/i)).toHaveValue('coca');
    });

    test('the currently-selected price is marked, and only it has Delete disabled', async () => {
      renderPage();
      await openDetail();
      await screen.findByText('SM Supermarket');

      const selectedRow = screen.getByText('Puregold').closest('tr') as HTMLElement;
      const otherRow = screen.getByText('SM Supermarket').closest('tr') as HTMLElement;

      expect(within(selectedRow).getByText(/selected/i)).toBeInTheDocument();
      expect(within(otherRow).queryByText(/^selected$/i)).not.toBeInTheDocument();
      expect(within(selectedRow).getByRole('button', { name: /delete puregold/i })).toBeDisabled();
      expect(within(selectedRow).getByRole('button', { name: /delete puregold/i })).toHaveAttribute('title');
      expect(within(otherRow).getByRole('button', { name: /delete sm supermarket/i })).toBeEnabled();
    });

    test('the selected price has no "use as sale price source" action; the other does', async () => {
      renderPage();
      await openDetail();
      await screen.findByText('SM Supermarket');
      expect(screen.queryByRole('button', { name: /use puregold as sale price source/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use sm supermarket as sale price source/i })).toBeInTheDocument();
    });

    test('a failing store-price load shows the error, not an empty table', async () => {
      (listStorePrices as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
      renderPage();
      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coca' } });
      fireEvent.click(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('db down');
      expect(screen.queryByText(/no store prices yet/i)).not.toBeInTheDocument();
    });
  });

  describe('selecting the sale price source', () => {
    test('PATCHes the product with the chosen store price, then refreshes it and the Products dashboard', async () => {
      (updateProduct as ReturnType<typeof vi.fn>).mockResolvedValue({ ...product, selected_store_price_id: 2 });
      const { invalidate } = renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /use sm supermarket as sale price source/i }));

      await waitFor(() => expect(updateProduct).toHaveBeenCalledWith(1, { selected_store_price_id: 2 }));
      await waitFor(() => {
        const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
        expect(keys).toContain(JSON.stringify(['products']));
        expect(keys).toContain(JSON.stringify(['product', 1]));
      });
    });

    test('shows the error if selecting fails', async () => {
      (updateProduct as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'Store price not found' }));
      renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /use sm supermarket as sale price source/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Store price not found');
    });
  });

  describe('deleting a store price', () => {
    test('confirming deletes a non-selected price and refreshes the list', async () => {
      (deleteStorePrice as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { invalidate } = renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /delete sm supermarket/i }));
      fireEvent.click(screen.getByRole('button', { name: /^delete store price$/i }));

      await waitFor(() => expect(deleteStorePrice).toHaveBeenCalledWith(2));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['store-prices', 1] });
    });

    test('cancelling does not delete', async () => {
      renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /delete sm supermarket/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(deleteStorePrice).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('a failed delete shows the error inside the dialog', async () => {
      (deleteStorePrice as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(409, { error: 'Cannot delete a store price that is currently selected for a product' })
      );
      renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /delete sm supermarket/i }));
      fireEvent.click(screen.getByRole('button', { name: /^delete store price$/i }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/currently selected/i);
    });
  });

  describe('adding and editing a store price', () => {
    test('adding POSTs the new price and refreshes the list', async () => {
      (createStorePrice as ReturnType<typeof vi.fn>).mockResolvedValue({ ...storePrices[0], id: 9 });
      renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /add store price/i }));
      fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'S&R' } });
      fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '65.50' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(createStorePrice).toHaveBeenCalledWith(1, { store_name: 'S&R', price: 6550 }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('editing PATCHes the store price and, since it may be the sale source, refreshes the Products dashboard', async () => {
      (updateStorePrice as ReturnType<typeof vi.fn>).mockResolvedValue(storePrices[1]);
      const { invalidate } = renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /edit puregold/i }));
      fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '60' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(updateStorePrice).toHaveBeenCalledWith(3, { store_name: 'Puregold', price: 6000 }));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['products'] }));
    });

    test('a server error stays in the still-open form', async () => {
      (createStorePrice as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'Product not found' }));
      renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /add store price/i }));
      fireEvent.change(screen.getByLabelText(/store name/i), { target: { value: 'S&R' } });
      fireEvent.change(screen.getByLabelText(/^price \(/i), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Product not found');
    });
  });
});
