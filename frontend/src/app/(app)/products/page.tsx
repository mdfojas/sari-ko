'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ROUTE_ACCESS } from '@/lib/route-access';
import { TopbarSlot } from '@/components/topbar-slot';
import { BarcodeScannerButton } from '@/components/barcode-scanner-button';
import { ProductsTable } from '@/components/products-table';
import { ProductFormModal } from '@/components/product-form-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { resolveProductSearch } from '@/lib/product-search';
import { applyProductFilter, type ProductFilter } from '@/lib/product-filters';
import { ApiError } from '@/lib/api-client';
import {
  createProduct,
  deleteProduct,
  updateProduct,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from '@/lib/products-client';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const ALLOWED_ROLES = ROUTE_ACCESS['/products'];
const SEARCH_DEBOUNCE_MS = 300;

const FILTER_LABELS: Record<ProductFilter, string> = {
  all: 'All',
  'has-barcode': 'Has barcode',
};

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: string } | null;
    if (body?.error) return body.error;
  }
  return 'Something went wrong. Please try again.';
}

export default function ProductsPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [revealed, setRevealed] = useState(PAGE_SIZE_OPTIONS[0]);
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const debouncedSearchText = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);

  const {
    data,
    isLoading,
    isError,
    error: searchError,
  } = useQuery({
    queryKey: ['products', debouncedSearchText],
    queryFn: () => resolveProductSearch(debouncedSearchText),
  });

  const matches = data?.matches ?? [];
  const exact = data?.exact ?? null;
  const filtered = applyProductFilter(matches, filter);
  const shown = filtered.slice(0, revealed);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: () => {
      invalidate();
      setEditingProduct(null);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(extractErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateProductInput }) => updateProduct(id, input),
    onSuccess: () => {
      invalidate();
      setEditingProduct(null);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      invalidate();
      setDeletingProduct(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err)),
  });

  function handleSearchChange(value: string) {
    setSearchText(value);
    setRevealed(pageSize);
  }

  function handleSave(input: CreateProductInput | UpdateProductInput) {
    if (editingProduct && editingProduct !== 'new') {
      updateMutation.mutate({ id: editingProduct.id, input: input as UpdateProductInput });
    } else {
      createMutation.mutate(input as CreateProductInput);
    }
  }

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">Products</h1>
        <input
          aria-label="Search products"
          placeholder="Search name/alias or scan barcode..."
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-64 rounded border border-border px-3 py-2 text-sm"
        />
        <BarcodeScannerButton onScan={handleSearchChange} />
        {(Object.keys(FILTER_LABELS) as ProductFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setRevealed(pageSize);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === f ? 'border-accent bg-accent-light text-accent-dark' : 'border-border text-text-muted'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setEditingProduct('new')}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white"
        >
          + Add Product
        </button>
      </TopbarSlot>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : isError ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            {extractErrorMessage(searchError)}
          </p>
        ) : (
          <ProductsTable
            products={shown}
            exactBarcodeMatchId={exact?.id}
            onEdit={setEditingProduct}
            onDelete={(product) => {
              setDeletingProduct(product);
              setDeleteError(null);
            }}
          />
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-border p-3 text-sm text-text-muted">
            <span>
              Showing {shown.length} of {filtered.length}
            </span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                Results per load
                <select
                  aria-label="Results per load"
                  value={pageSize}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    setPageSize(size);
                    setRevealed(size);
                  }}
                  className="rounded border border-border bg-card px-2 py-1 text-text"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              {filtered.length > shown.length && (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => r + pageSize)}
                  className="font-semibold text-accent-dark"
                >
                  Load {Math.min(pageSize, filtered.length - shown.length)} more
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {editingProduct !== null && (
        <ProductFormModal
          product={editingProduct === 'new' ? undefined : editingProduct}
          onSave={handleSave}
          onClose={() => {
            setEditingProduct(null);
            setFormError(null);
          }}
          error={formError}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {deletingProduct && (
        <ConfirmDialog
          title="Delete this product?"
          body={`"${deletingProduct.name}" and its store-price entries will be removed. This cannot be undone.`}
          confirmLabel="Delete Product"
          error={deleteError}
          isConfirming={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingProduct.id)}
          onCancel={() => {
            setDeletingProduct(null);
            setDeleteError(null);
          }}
        />
      )}
    </>
  );
}
