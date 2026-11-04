'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/modal';
import { pesosToCentavos } from '@/lib/money';
import { listDistinctStoreNames, type StorePrice, type StorePriceInput } from '@/lib/store-prices-client';

interface StorePriceFormModalProps {
  storePrice?: StorePrice;
  onSave: (input: StorePriceInput) => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

export function StorePriceFormModal({
  storePrice,
  onSave,
  onClose,
  error,
  isSaving = false,
}: StorePriceFormModalProps) {
  const isEdit = Boolean(storePrice);
  const [storeName, setStoreName] = useState(storePrice?.store_name ?? '');
  const [price, setPrice] = useState(storePrice ? (storePrice.price / 100).toFixed(2) : '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: knownStoreNames = [] } = useQuery({
    queryKey: ['store-names'],
    queryFn: listDistinctStoreNames,
  });

  function handleSubmit() {
    if (isSaving) return;
    if (!storeName.trim()) {
      setValidationError('Store name is required.');
      return;
    }
    const priceCentavos = pesosToCentavos(price);
    if (priceCentavos <= 0) {
      setValidationError('Price must be greater than ₱0.');
      return;
    }
    setValidationError(null);
    onSave({ store_name: storeName.trim(), price: priceCentavos });
  }

  return (
    <Modal ariaLabel={isEdit ? 'Edit store price' : 'Add store price'}>
      <h3 className="mb-4 text-base font-bold text-text">{isEdit ? 'Edit store price' : 'Add store price'}</h3>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="sp-store-name" className="mb-1 block text-xs font-semibold text-text-muted">
          Store name
        </label>
        <input
          id="sp-store-name"
          list="sp-store-name-options"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="pick an existing store or type a new one"
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
        <datalist id="sp-store-name-options">
          {knownStoreNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="mb-3">
        <label htmlFor="sp-price" className="mb-1 block text-xs font-semibold text-text-muted">
          Price (₱)
        </label>
        <input
          id="sp-price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 12.00"
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
