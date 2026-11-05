import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import StorePricesPage from '@/app/(app)/store-prices/page';
import { useAuth } from '@/contexts/auth-context';
import { resolveProductSearch } from '@/lib/product-search';
import { listPricesAtStore, listStores, type StoreSummary } from '@/lib/stores-client';
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
vi.mock('@/components/manage-stores-modal', () => ({
  ManageStoresModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Manage stores">
      <button onClick={onClose}>close-stores</button>
    </div>
  ),
}));
vi.mock('@/lib/stores-client', () => ({ listStores: vi.fn(), listPricesAtStore: vi.fn() }));
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

const storeList: StoreSummary[] = [
  { id: 10, name: 'Puregold', price_count: 2, selected_count: 1 },
  { id: 11, name: 'SM Supermarket', price_count: 1, selected_count: 0 },
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
  return { invalidate, queryClient };
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
    (listStores as ReturnType<typeof vi.fn>).mockResolvedValue(storeList);
    (listPricesAtStore as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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

  describe('browse and search', () => {
    const manyProducts = (n: number): Product[] =>
      Array.from({ length: n }, (_, i) => ({ ...product, id: 100 + i, name: `Product ${i + 1}`, barcode: null }));

    test('lists products right away, without typing anything', async () => {
      renderPage();
      expect(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ })).toBeInTheDocument();
      expect(resolveProductSearch).toHaveBeenCalledWith('');
      expect(screen.queryByText(/search for a product/i)).not.toBeInTheDocument();
    });

    test('has a "Manage stores" button that opens the store manager, and closing it returns to the list', async () => {
      renderPage();
      await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ });
      expect(screen.queryByRole('dialog', { name: /manage stores/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /manage stores/i }));
      expect(screen.getByRole('dialog', { name: /manage stores/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'close-stores' }));
      expect(screen.queryByRole('dialog', { name: /manage stores/i })).not.toBeInTheDocument();
    });

    test('the "Manage stores" button is not shown inside a product\'s detail view', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ }));
      await screen.findByRole('heading', { name: 'Coca-Cola 1.5L' });
      expect(screen.queryByRole('button', { name: /manage stores/i })).not.toBeInTheDocument();
    });

    describe('filter by store', () => {
      const p1: Product = { ...product, id: 1, name: 'Coca-Cola 1.5L' };
      const p2: Product = { ...product, id: 2, name: 'Sprite 1.5L', barcode: null };
      const p3: Product = { ...product, id: 3, name: 'Royal 1L', barcode: null };
      const storeFilter = () => screen.getByLabelText(/filter by store/i) as HTMLSelectElement;
      const pickStore = (id: string) => fireEvent.change(storeFilter(), { target: { value: id } });

      beforeEach(() => {
        (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [p1, p2, p3], exact: null });
        // Puregold prices Sprite and Royal only; SM prices Coca-Cola only.
        (listPricesAtStore as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) =>
          id === 10
            ? [{ id: 21, product_id: 2, price: 7000 }, { id: 22, product_id: 3, price: 4600 }]
            : [{ id: 23, product_id: 1, price: 7000 }]
        );
      });

      test('offers "All stores" and every store, next to the name search', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ });
        await screen.findByRole('option', { name: 'Puregold' });
        expect(Array.from(storeFilter().options).map((o) => o.textContent)).toEqual(['All stores', 'Puregold', 'SM Supermarket']);
        expect(storeFilter()).toHaveValue('');
      });

      test('shows every product when no store is chosen, and asks the backend for nothing', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ });
        expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument();
        expect(listPricesAtStore).not.toHaveBeenCalled();
      });

      test('choosing a store lists only the products that have a price at it', async () => {
        renderPage();
        await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ });
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');

        await waitFor(() => expect(listPricesAtStore).toHaveBeenCalledWith(10));
        await waitFor(() => expect(screen.queryByRole('button', { name: /Coca-Cola 1\.5L/ })).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: /Sprite 1\.5L/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Royal 1L/ })).toBeInTheDocument();
        expect(screen.getByText('Showing 2 of 2')).toBeInTheDocument();
      });

      test('switching to another store changes the list, and "All stores" brings everything back', async () => {
        renderPage();
        await screen.findByRole('option', { name: 'SM Supermarket' });
        pickStore('11');
        expect(await screen.findByText('Showing 1 of 1')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Coca-Cola 1\.5L/ })).toBeInTheDocument();

        pickStore('');
        expect(await screen.findByText('Showing 3 of 3')).toBeInTheDocument();
      });

      test('combines with the name search', async () => {
        (resolveProductSearch as ReturnType<typeof vi.fn>).mockImplementation(async (q: string) => ({
          matches: q === '' ? [p1, p2, p3] : [p2, p1],
          exact: null,
        }));
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');
        fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'sprite' } });

        await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('sprite'));
        // The search returned Sprite and Coca-Cola, but only Sprite is priced at Puregold.
        await waitFor(() => expect(screen.getByText('Showing 1 of 1')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: /Sprite 1\.5L/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Coca-Cola 1\.5L/ })).not.toBeInTheDocument();
      });

      test('waits for the store\'s prices instead of briefly showing the unfiltered list', async () => {
        (listPricesAtStore as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');

        expect(await screen.findByText(/loading/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Coca-Cola 1\.5L/ })).not.toBeInTheDocument();
      });

      test('a failing load of the store\'s prices shows the error, not an empty or unfiltered list', async () => {
        (listPricesAtStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'prices down' }));
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');

        expect(await screen.findByRole('alert')).toHaveTextContent('prices down');
        expect(screen.queryByText(/no products/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Coca-Cola 1\.5L/ })).not.toBeInTheDocument();
      });

      test('says so when no product has a price at the store', async () => {
        (listPricesAtStore as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');
        expect(await screen.findByText('No products have a price at "Puregold".')).toBeInTheDocument();
      });

      test('says "no products match" when a search and the store filter leave nothing', async () => {
        (resolveProductSearch as ReturnType<typeof vi.fn>).mockImplementation(async (q: string) => ({
          matches: q === '' ? [p1, p2, p3] : [p1],
          exact: null,
        }));
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');
        fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coca' } });
        expect(await screen.findByText('No products match.')).toBeInTheDocument();
      });

      test('a change of store starts again from the first page', async () => {
        const many = Array.from({ length: 45 }, (_, i) => ({ ...product, id: 100 + i, name: `Item ${i + 1}`, barcode: null }));
        (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: many, exact: null });
        (listPricesAtStore as ReturnType<typeof vi.fn>).mockResolvedValue(many.map((m, i) => ({ id: i, product_id: m.id, price: 100 })));
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        fireEvent.click(await screen.findByRole('button', { name: 'Load 20 more' }));
        expect(screen.getByText('Showing 40 of 45')).toBeInTheDocument();

        pickStore('10');
        await waitFor(() => expect(screen.getByText('Showing 20 of 45')).toBeInTheDocument());
      });

      test('the filter drops back to "All stores" if the chosen store no longer exists (merged or deleted)', async () => {
        const { queryClient } = renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');
        await waitFor(() => expect(storeFilter()).toHaveValue('10'));

        act(() => {
          queryClient.setQueryData(['stores'], [storeList[1]]);
        });

        await waitFor(() => expect(storeFilter()).toHaveValue(''));
        expect(await screen.findByText('Showing 3 of 3')).toBeInTheDocument();
      });

      test('is not shown inside a product\'s detail view', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ }));
        await screen.findByRole('heading', { name: 'Coca-Cola 1.5L' });
        expect(screen.queryByLabelText(/filter by store/i)).not.toBeInTheDocument();
      });

      test('keeps the choice when going into a product and back', async () => {
        renderPage();
        await screen.findByRole('option', { name: 'Puregold' });
        pickStore('10');
        fireEvent.click(await screen.findByRole('button', { name: /Sprite 1\.5L/ }));
        fireEvent.click(await screen.findByRole('button', { name: /back to search/i }));

        await waitFor(() => expect(storeFilter()).toHaveValue('10'));
      });
    });

    test('lists them in a table with the same columns as Products', async () => {
      renderPage();
      await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ });
      expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
        'Name',
        'Barcode',
        'Sale price',
        'Store price',
        'Selected store',
        'Aliases',
        '',
      ]);
      const row = screen.getByRole('button', { name: /Coca-Cola 1\.5L/ }).closest('tr') as HTMLElement;
      expect(within(row).getByText('4800361500017')).toBeInTheDocument();
      expect(within(row).getByText('₱85.00')).toBeInTheDocument();
      expect(within(row).getByText('₱65.00')).toBeInTheDocument();
      expect(within(row).getByText('Puregold')).toBeInTheDocument();
    });

    test('clicking a cell of the row (not just the name) opens the detail view', async () => {
      renderPage();
      const row = (await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ })).closest('tr') as HTMLElement;
      fireEvent.click(within(row).getByText('₱85.00'));
      expect(await screen.findByRole('heading', { name: 'Coca-Cola 1.5L' })).toBeInTheDocument();
    });

    test('an exact barcode match is badged in the table', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [product], exact: product });
      renderPage();
      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: '4800361500017' } });
      expect(await screen.findByText(/exact barcode match/i)).toBeInTheDocument();
    });

    test('shows the first 20 with "Load N more", then reveals the rest', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: manyProducts(25), exact: null });
      renderPage();
      await screen.findByRole('button', { name: /^Product 1(?!\d)/ });
      expect(screen.getByText('Showing 20 of 25')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Product 21(?!\d)/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
      expect(await screen.findByRole('button', { name: /^Product 25(?!\d)/ })).toBeInTheDocument();
      expect(screen.getByText('Showing 25 of 25')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /load/i })).not.toBeInTheDocument();
    });

    test('lets you choose how many to load at a time (20, 50 or 100)', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: manyProducts(60), exact: null });
      renderPage();
      await screen.findByRole('button', { name: /^Product 1(?!\d)/ });
      expect(within(screen.getByLabelText(/results per load/i)).getAllByRole('option').map((o) => o.textContent)).toEqual(['20', '50', '100']);

      fireEvent.change(screen.getByLabelText(/results per load/i), { target: { value: '50' } });
      expect(screen.getByText('Showing 50 of 60')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load 10 more' })).toBeInTheDocument();
    });

    test('a new search starts again from the first page', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: manyProducts(45), exact: null });
      renderPage();
      await screen.findByRole('button', { name: /^Product 1(?!\d)/ });
      fireEvent.click(screen.getByRole('button', { name: 'Load 20 more' }));
      expect(screen.getByText('Showing 40 of 45')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'product' } });
      await waitFor(() => expect(screen.getByText('Showing 20 of 45')).toBeInTheDocument());
    });

    test('says so when the store has no products yet', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [], exact: null });
      renderPage();
      expect(await screen.findByText(/no products yet/i)).toBeInTheDocument();
    });

    test('a failing load of the first list shows the error, not an empty list', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      renderPage();
      expect(await screen.findByRole('alert')).toHaveTextContent('boom');
      expect(screen.queryByText(/no products/i)).not.toBeInTheDocument();
    });

    test('searching by name lists the matching products', async () => {
      renderPage();
      fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coca' } });
      await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('coca'));
      expect(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ })).toBeInTheDocument();
    });

    test('scanning a barcode searches for it and resolves to the single matching product', async () => {
      (resolveProductSearch as ReturnType<typeof vi.fn>).mockResolvedValue({ matches: [product], exact: product });
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'stub-scan' }));
      await waitFor(() => expect(resolveProductSearch).toHaveBeenCalledWith('4800361500017'));
      expect(await screen.findByRole('button', { name: /Coca-Cola 1\.5L/ })).toBeInTheDocument();
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

    test('also refreshes the cached search results, which carry the sale source', async () => {
      (updateProduct as ReturnType<typeof vi.fn>).mockResolvedValue({ ...product, selected_store_price_id: 2 });
      const { invalidate } = renderPage();
      await openDetail();
      fireEvent.click(await screen.findByRole('button', { name: /use sm supermarket as sale price source/i }));

      await waitFor(() => {
        const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
        expect(keys).toContain(JSON.stringify(['store-prices-search']));
        // The store filter's price lists must refresh too, or a store filter would show stale products.
        expect(keys).toContain(JSON.stringify(['store-prices-at-store']));
        // A price can bring a brand-new store into being, so the store lists refresh too.
        expect(keys).toContain(JSON.stringify(['stores']));
      });
    });

    test('clears an earlier select error once any later action succeeds', async () => {
      (updateProduct as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new ApiError(404, { error: 'Store price not found' }))
        .mockResolvedValueOnce({ ...product, selected_store_price_id: 2 });
      renderPage();
      await openDetail();
      const select = await screen.findByRole('button', { name: /use sm supermarket as sale price source/i });
      fireEvent.click(select);
      expect(await screen.findByRole('alert')).toHaveTextContent('Store price not found');

      fireEvent.click(select);
      await waitFor(() => expect(screen.queryByText('Store price not found')).not.toBeInTheDocument());
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
