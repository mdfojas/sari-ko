'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StorePriceFormModal } from '@/components/store-price-form-modal';
import { extractErrorMessage } from '@/lib/error-message';
import { peso } from '@/lib/money';
import { getProduct, updateProduct } from '@/lib/products-client';
import {
  createStorePrice,
  deleteStorePrice,
  listStorePrices,
  updateStorePrice,
  type StorePrice,
  type StorePriceInput,
} from '@/lib/store-prices-client';

const SELECTED_DELETE_HINT =
  "This is the product's sale-price source. Select another store price first, then delete this one.";

interface StorePricesDetailProps {
  productId: number;
  onBack: () => void;
}

export function StorePricesDetail({ productId, onBack }: StorePricesDetailProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StorePrice | 'new' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StorePrice | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const productQuery = useQuery({ queryKey: ['product', productId], queryFn: () => getProduct(productId) });
  const pricesQuery = useQuery({
    queryKey: ['store-prices', productId],
    queryFn: () => listStorePrices(productId),
  });

  // Any change here can alter what the Products dashboard shows (the sale
  // source's store/price), so refresh it too.
  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['store-prices', productId] });
    queryClient.invalidateQueries({ queryKey: ['product', productId] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    // The search-first page caches results per query; they carry the sale source.
    queryClient.invalidateQueries({ queryKey: ['store-prices-search'] });
    setActionError(null);
  }

  const selectMutation = useMutation({
    mutationFn: (storePriceId: number) => updateProduct(productId, { selected_store_price_id: storePriceId }),
    onSuccess: () => {
      refresh();
    },
    onError: (err: unknown) => setActionError(extractErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: StorePriceInput }) =>
      id === null ? createStorePrice(productId, input) : updateStorePrice(id, input),
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['store-names'] });
      setEditing(null);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteStorePrice(id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err)),
  });

  function handleSave(input: StorePriceInput) {
    saveMutation.mutate({ id: editing && editing !== 'new' ? editing.id : null, input });
  }

  const product = productQuery.data;
  const storePrices = pricesQuery.data ?? [];
  const loadError = productQuery.isError ? productQuery.error : pricesQuery.isError ? pricesQuery.error : null;

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 text-sm font-semibold text-accent-dark">
        ← Back to search
      </button>

      {productQuery.isLoading || pricesQuery.isLoading ? (
        <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="p-6 text-center text-sm text-danger">
          {extractErrorMessage(loadError)}
        </p>
      ) : (
        product && (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-text">{product.name}</h2>
                <p className="text-sm text-text-muted">
                  {product.barcode ? <code>{product.barcode}</code> : 'No barcode'} · Sale price{' '}
                  {peso(product.sale_price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setEditing('new');
                }}
                className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white"
              >
                + Add store price
              </button>
            </div>

            {actionError && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {actionError}
              </p>
            )}

            <div className="rounded-lg border border-border bg-card">
              {storePrices.length === 0 ? (
                <p className="p-6 text-center text-sm text-text-muted">No store prices yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                      <th className="px-4 py-3">Store</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {storePrices.map((storePrice) => {
                      const isSelected = product.selected_store_price_id === storePrice.id;
                      return (
                        <tr
                          key={storePrice.id}
                          className={`border-b border-border ${isSelected ? 'bg-accent-light' : ''}`}
                        >
                          <td className="px-4 py-3 font-semibold text-text">{storePrice.store_name}</td>
                          <td className="px-4 py-3 tabular-nums text-text">{peso(storePrice.price)}</td>
                          <td className="px-4 py-3">
                            {isSelected && (
                              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                                Selected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isSelected && (
                              <button
                                type="button"
                                aria-label={`Use ${storePrice.store_name} as sale price source`}
                                disabled={selectMutation.isPending}
                                onClick={() => selectMutation.mutate(storePrice.id)}
                                className="mr-2 text-xs font-semibold text-accent-dark disabled:opacity-50"
                              >
                                Use as source
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Edit ${storePrice.store_name}`}
                              onClick={() => {
                                setFormError(null);
                                setEditing(storePrice);
                              }}
                              className="px-1 text-text-muted hover:text-text"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${storePrice.store_name}`}
                              disabled={isSelected}
                              title={isSelected ? SELECTED_DELETE_HINT : undefined}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleting(storePrice);
                              }}
                              className="px-1 text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )
      )}

      {editing !== null && (
        <StorePriceFormModal
          key={editing === 'new' ? 'new' : editing.id}
          storePrice={editing === 'new' ? undefined : editing}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
            setFormError(null);
          }}
          error={formError}
          isSaving={saveMutation.isPending}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this store price?"
          body={`${deleting.store_name} (${peso(deleting.price)}) will be removed. This cannot be undone.`}
          confirmLabel="Delete Store Price"
          error={deleteError}
          isConfirming={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
