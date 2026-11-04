'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { centavosToPesoInput, parsePesoInput } from '@/lib/money';
import { listDistinctStoreNames } from '@/lib/store-prices-client';
import { BarcodeScannerButton } from '@/components/barcode-scanner-button';
import { Modal } from '@/components/modal';
import type { CreateProductInput, Product, UpdateProductInput } from '@/lib/products-client';

interface ProductFormModalProps {
  product?: Product;
  onSave: (input: CreateProductInput | UpdateProductInput) => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

export function ProductFormModal({ product, onSave, onClose, error, isSaving = false }: ProductFormModalProps) {
  const isEdit = Boolean(product);
  const [name, setName] = useState(product?.name ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [aliases, setAliases] = useState(product?.other_names.join(', ') ?? '');
  const [salePrice, setSalePrice] = useState(product ? centavosToPesoInput(product.sale_price) : '');
  const [storeName, setStoreName] = useState('');
  const [storePrice, setStorePrice] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: knownStoreNames = [] } = useQuery({
    queryKey: ['store-names'],
    queryFn: listDistinctStoreNames,
    enabled: !isEdit,
  });

  function handleSubmit() {
    if (isSaving) return;
    if (!name.trim()) {
      setValidationError('Name is required.');
      return;
    }
    const salePriceCentavos = parsePesoInput(salePrice);
    if (salePriceCentavos === null || salePriceCentavos <= 0) {
      setValidationError('Sale price must be greater than ₱0 and at most ₱21,474,836.47, like 21.25.');
      return;
    }

    const otherNames = aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (isEdit) {
      setValidationError(null);
      onSave({
        name: name.trim(),
        barcode: barcode.trim() || null,
        other_names: otherNames,
        sale_price: salePriceCentavos,
      });
      return;
    }

    const storePriceCentavos = parsePesoInput(storePrice);
    if (!storeName.trim() || storePriceCentavos === null || storePriceCentavos <= 0) {
      setValidationError(
        'The initial store name and a store price between ₱0.01 and ₱21,474,836.47 (like 12.00) are required.'
      );
      return;
    }
    setValidationError(null);

    onSave({
      name: name.trim(),
      barcode: barcode.trim() || null,
      other_names: otherNames,
      sale_price: salePriceCentavos,
      store_prices: [{ store_name: storeName.trim(), price: storePriceCentavos, selected: true }],
    });
  }

  return (
    <Modal ariaLabel={isEdit ? 'Edit product' : 'Add product'}>
      <h3 className="mb-4 text-base font-bold text-text">{isEdit ? 'Edit product' : 'Add product'}</h3>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="pf-name" className="mb-1 block text-xs font-semibold text-text-muted">
          Name
        </label>
        <input
          id="pf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="pf-barcode" className="mb-1 block text-xs font-semibold text-text-muted">
          Barcode
        </label>
        <div className="flex gap-2">
          <input
            id="pf-barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="leave blank if none"
            className="w-full rounded border border-border px-3 py-2 text-sm text-text"
          />
          <BarcodeScannerButton onScan={setBarcode} />
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="pf-aliases" className="mb-1 block text-xs font-semibold text-text-muted">
          Aliases (comma-separated)
        </label>
        <input
          id="pf-aliases"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="pf-sale-price" className="mb-1 block text-xs font-semibold text-text-muted">
          Sale price (₱)
        </label>
        <input
          id="pf-sale-price"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="e.g. 21.25"
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      {!isEdit && (
        <>
          <div className="mb-3">
            <label htmlFor="pf-store-name" className="mb-1 block text-xs font-semibold text-text-muted">
              Initial store price — store name
            </label>
            <input
              id="pf-store-name"
              list="pf-store-name-options"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="pick an existing store or type a new one"
              className="w-full rounded border border-border px-3 py-2 text-sm text-text"
            />
            <datalist id="pf-store-name-options">
              {knownStoreNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-text-muted">
              Pick one already in use, or type a new store name to create it.
            </p>
          </div>
          <div className="mb-3">
            <label htmlFor="pf-store-price" className="mb-1 block text-xs font-semibold text-text-muted">
              Store price (₱)
            </label>
            <input
              id="pf-store-price"
              value={storePrice}
              onChange={(e) => setStorePrice(e.target.value)}
              placeholder="e.g. 12.00"
              className="w-full rounded border border-border px-3 py-2 text-sm text-text"
            />
          </div>
        </>
      )}

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
