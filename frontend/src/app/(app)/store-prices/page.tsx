'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { BarcodeScannerButton } from '@/components/barcode-scanner-button';
import { LoadMoreFooter } from '@/components/load-more-footer';
import { ManageStoresModal } from '@/components/manage-stores-modal';
import { StorePricesProductTable } from '@/components/store-prices-product-table';
import { StorePricesDetail } from '@/components/store-prices-detail';
import { TopbarSlot } from '@/components/topbar-slot';
import { extractErrorMessage } from '@/lib/error-message';
import { resolveProductSearch } from '@/lib/product-search';
import { listPricesAtStore, listStores } from '@/lib/stores-client';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/store-prices'];
const SEARCH_DEBOUNCE_MS = 300;
// Browsing starts with the first 20, like the Products list, and loads more on request.
const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function StorePricesPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [managingStores, setManagingStores] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [revealed, setRevealed] = useState(PAGE_SIZE_OPTIONS[0]);

  const allowed = Boolean(user && ALLOWED_ROLES.includes(user.role));
  const query = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS).trim();
  const {
    data,
    isLoading,
    isError,
    error: searchError,
  } = useQuery({
    queryKey: ['store-prices-search', query],
    queryFn: () => resolveProductSearch(query),
    // An empty search lists every product, same as the Products page.
    enabled: allowed,
  });

  // The stores to filter by, and (once one is chosen) which products have a price there.
  const storesQuery = useQuery({ queryKey: ['stores'], queryFn: listStores, enabled: allowed });
  const stores = storesQuery.data;
  // If the chosen store was merged away or deleted, behave as "All stores" (a store id is never reused).
  const activeStoreId = storeId !== null && (stores === undefined || stores.some((s) => s.id === storeId)) ? storeId : null;
  const storePricesQuery = useQuery({
    queryKey: ['store-prices-at-store', activeStoreId],
    queryFn: () => listPricesAtStore(activeStoreId as number),
    enabled: allowed && activeStoreId !== null,
  });
  const productIdsAtStore = useMemo(
    () => new Set((storePricesQuery.data ?? []).map((price) => price.product_id)),
    [storePricesQuery.data],
  );

  if (!allowed) {
    return null;
  }

  if (selectedProductId !== null) {
    return (
      <>
        <TopbarSlot>
          <h1 className="text-lg font-bold text-text">Store Prices</h1>
        </TopbarSlot>
        <StorePricesDetail productId={selectedProductId} onBack={() => setSelectedProductId(null)} />
      </>
    );
  }

  const filteringByStore = activeStoreId !== null;
  const storeName = stores?.find((s) => s.id === activeStoreId)?.name ?? '';
  const loading = isLoading || (filteringByStore && storePricesQuery.isLoading);
  const failed = isError || (filteringByStore && storePricesQuery.isError);
  const failure = isError ? searchError : storePricesQuery.error;
  // Until the store's prices have arrived there is nothing trustworthy to show, so show nothing
  // rather than the unfiltered list.
  const matches = (data?.matches ?? []).filter((product) => !filteringByStore || productIdsAtStore.has(product.id));
  const shown = matches.slice(0, revealed);

  // A new search starts again from the first page.
  function handleSearchChange(value: string) {
    setSearchText(value);
    setRevealed(pageSize);
  }

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">Store Prices</h1>
        <input
          aria-label="Search products"
          placeholder="Search name/alias or scan barcode..."
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-64 rounded border border-border px-3 py-2 text-sm"
        />
        <BarcodeScannerButton onScan={handleSearchChange} />
        <select
          aria-label="Filter by store"
          value={activeStoreId === null ? '' : String(activeStoreId)}
          onChange={(e) => {
            setStoreId(e.target.value === '' ? null : Number(e.target.value));
            setRevealed(pageSize);
          }}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-text"
        >
          <option value="">All stores</option>
          {(stores ?? []).map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setManagingStores(true)}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text"
        >
          Manage stores
        </button>
      </TopbarSlot>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : failed ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            {extractErrorMessage(failure)}
          </p>
        ) : matches.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            {query !== ''
              ? 'No products match.'
              : filteringByStore
                ? `No products have a price at "${storeName}".`
                : 'No products yet.'}
          </p>
        ) : (
          <StorePricesProductTable
            products={shown}
            exactBarcodeMatchId={data?.exact?.id ?? null}
            onSelect={(product) => setSelectedProductId(product.id)}
          />
        )}
        {!loading && !failed && matches.length > 0 && (
          <LoadMoreFooter
            shown={shown.length}
            total={matches.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setRevealed(size);
            }}
            onLoadMore={() => setRevealed((r) => r + pageSize)}
          />
        )}
      </div>
      {managingStores && <ManageStoresModal onClose={() => setManagingStores(false)} />}
    </>
  );
}
