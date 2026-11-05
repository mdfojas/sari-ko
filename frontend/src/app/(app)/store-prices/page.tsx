'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { BarcodeScannerButton } from '@/components/barcode-scanner-button';
import { StorePricesDetail } from '@/components/store-prices-detail';
import { TopbarSlot } from '@/components/topbar-slot';
import { extractErrorMessage } from '@/lib/error-message';
import { peso } from '@/lib/money';
import { resolveProductSearch } from '@/lib/product-search';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/store-prices'];
const SEARCH_DEBOUNCE_MS = 300;

export default function StorePricesPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const query = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS).trim();
  const {
    data,
    isLoading,
    isError,
    error: searchError,
  } = useQuery({
    queryKey: ['store-prices-search', query],
    queryFn: () => resolveProductSearch(query),
    enabled: query !== '',
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
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

  const matches = data?.matches ?? [];

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">Store Prices</h1>
        <input
          aria-label="Search products"
          placeholder="Search name/alias or scan barcode..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-64 rounded border border-border px-3 py-2 text-sm"
        />
        <BarcodeScannerButton onScan={setSearchText} />
      </TopbarSlot>

      <div className="rounded-lg border border-border bg-card">
        {query === '' ? (
          <p className="p-6 text-center text-sm text-text-muted">
            Search for a product by name or scan its barcode to manage its store prices.
          </p>
        ) : isLoading ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : isError ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            {extractErrorMessage(searchError)}
          </p>
        ) : matches.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">No products match.</p>
        ) : (
          <ul>
            {matches.map((product) => (
              <li key={product.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedProductId(product.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-accent-light"
                >
                  <span>
                    <span className="font-semibold text-text">{product.name}</span>{' '}
                    {product.barcode && <code className="text-text-muted">{product.barcode}</code>}
                  </span>
                  <span className="text-text-muted">
                    {typeof product.original_price === 'number' && product.selected_store_name
                      ? `${product.selected_store_name} · ${peso(product.original_price)}`
                      : 'No sale-price source'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
