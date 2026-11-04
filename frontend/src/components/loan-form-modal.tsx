'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/modal';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { CreateLoanInput, NewLineItem } from '@/lib/loans-client';
import { peso, pesosToCentavos } from '@/lib/money';
import { searchProducts, type Product } from '@/lib/products-client';

const SEARCH_DEBOUNCE_MS = 300;

interface Row {
  key: number;
  mode: 'catalog' | 'freeform';
  product: Product | null;
  search: string;
  quantity: string;
  description: string;
  amount: string;
}

const newRow = (key: number): Row => ({
  key,
  mode: 'catalog',
  product: null,
  search: '',
  quantity: '1',
  description: '',
  amount: '',
});

const isWholeNumber = (value: string) => /^\d+$/.test(value) && Number(value) >= 1;

// What this line will add to the loan, in centavos, or null while incomplete.
// For a catalog line this is only a preview — the backend takes the real
// price snapshot from the product when the loan is created.
function lineAmount(row: Row): number | null {
  if (row.mode === 'catalog') {
    return row.product && isWholeNumber(row.quantity) ? row.product.sale_price * Number(row.quantity) : null;
  }
  const amount = pesosToCentavos(row.amount);
  return amount > 0 ? amount : null;
}

interface LineItemRowProps {
  index: number;
  row: Row;
  canRemove: boolean;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}

function LineItemRow({ index, row, canRemove, onChange, onRemove }: LineItemRowProps) {
  const n = index + 1;
  const query = useDebouncedValue(row.search, SEARCH_DEBOUNCE_MS).trim();
  const search = useQuery({
    queryKey: ['loan-product-search', query],
    queryFn: () => searchProducts(query),
    enabled: row.mode === 'catalog' && !row.product && query !== '',
  });
  const amount = lineAmount(row);

  const toggleClass = (active: boolean) =>
    `px-3 py-1 text-xs font-semibold ${active ? 'bg-accent text-white' : 'text-text-muted'}`;

  return (
    <div role="group" aria-label={`Line item ${n}`} className="mb-3 rounded border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex overflow-hidden rounded border border-border">
          <button
            type="button"
            aria-pressed={row.mode === 'catalog'}
            onClick={() => onChange({ mode: 'catalog' })}
            className={toggleClass(row.mode === 'catalog')}
          >
            Catalog
          </button>
          <button
            type="button"
            aria-pressed={row.mode === 'freeform'}
            onClick={() => onChange({ mode: 'freeform' })}
            className={toggleClass(row.mode === 'freeform')}
          >
            Freeform
          </button>
        </div>
        <button
          type="button"
          aria-label={`Remove line item ${n}`}
          disabled={!canRemove}
          onClick={onRemove}
          className="text-sm text-text-muted disabled:opacity-30"
        >
          ✕
        </button>
      </div>

      {row.mode === 'catalog' ? (
        <>
          {row.product ? (
            <p className="mb-2 flex items-center justify-between text-sm">
              <span>
                <span className="font-semibold text-text">{row.product.name}</span>{' '}
                <span className="text-text-muted">{peso(row.product.sale_price)} each</span>
              </span>
              <button
                type="button"
                onClick={() => onChange({ product: null, search: '' })}
                className="text-xs font-semibold text-accent-dark"
              >
                Change
              </button>
            </p>
          ) : (
            <div className="mb-2">
              <input
                aria-label="Search products"
                placeholder="Search products by name or alias..."
                value={row.search}
                onChange={(e) => onChange({ search: e.target.value })}
                className="w-full rounded border border-border px-3 py-2 text-sm text-text"
              />
              {search.isError && <p className="mt-1 text-xs text-danger">Couldn&apos;t search products. Try again.</p>}
              {search.data && search.data.length === 0 && (
                <p className="mt-1 text-xs text-text-muted">No products match.</p>
              )}
              {search.data && search.data.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto rounded border border-border">
                  {search.data.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => onChange({ product, search: '' })}
                        className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-accent-light"
                      >
                        <span>{product.name}</span>
                        <span className="text-text-muted">{peso(product.sale_price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-muted">
              Qty
              <input
                aria-label="Quantity"
                value={row.quantity}
                onChange={(e) => onChange({ quantity: e.target.value })}
                className="w-16 rounded border border-border px-2 py-1 text-sm text-text"
              />
            </label>
            <span className="text-sm font-semibold tabular-nums text-text">{amount === null ? '—' : peso(amount)}</span>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <input
            aria-label="Description"
            placeholder="Description"
            value={row.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="flex-1 rounded border border-border px-3 py-2 text-sm text-text"
          />
          <input
            aria-label="Amount (₱)"
            placeholder="Amount (₱)"
            value={row.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            className="w-28 rounded border border-border px-3 py-2 text-sm text-text"
          />
        </div>
      )}
    </div>
  );
}

interface LoanFormModalProps {
  personName: string;
  onSave: (input: CreateLoanInput) => void;
  onClose: () => void;
  error?: string | null;
  isSaving?: boolean;
}

export function LoanFormModal({ personName, onSave, onClose, error, isSaving = false }: LoanFormModalProps) {
  const [rows, setRows] = useState<Row[]>([newRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const total = rows.reduce((sum, row) => sum + (lineAmount(row) ?? 0), 0);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, newRow(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function handleSubmit() {
    if (isSaving) return;

    const lineItems: NewLineItem[] = [];
    for (const [index, row] of rows.entries()) {
      const n = index + 1;
      if (row.mode === 'catalog') {
        if (!row.product) {
          setValidationError(`Choose a product for line item ${n}.`);
          return;
        }
        if (!isWholeNumber(row.quantity)) {
          setValidationError(`Quantity for line item ${n} must be a whole number of at least 1.`);
          return;
        }
        lineItems.push({ product_id: row.product.id, quantity: Number(row.quantity) });
      } else {
        if (!row.description.trim()) {
          setValidationError(`Enter a description for line item ${n}.`);
          return;
        }
        const amount = pesosToCentavos(row.amount);
        if (amount <= 0) {
          setValidationError(`Amount for line item ${n} must be greater than ₱0.`);
          return;
        }
        lineItems.push({ description: row.description.trim(), amount });
      }
    }

    setValidationError(null);
    const input: CreateLoanInput = { line_items: lineItems };
    if (note.trim()) input.note = note.trim();
    onSave(input);
  }

  return (
    <Modal ariaLabel="New loan" wide>
      <h3 className="mb-1 text-base font-bold text-text">New loan</h3>
      <p className="mb-4 text-sm text-text-muted">
        For <strong className="text-text">{personName}</strong>
      </p>

      {(validationError || error) && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {validationError || error}
        </p>
      )}

      {rows.map((row, index) => (
        <LineItemRow
          key={row.key}
          index={index}
          row={row}
          canRemove={rows.length > 1}
          onChange={(patch) => updateRow(row.key, patch)}
          onRemove={() => setRows((current) => current.filter((r) => r.key !== row.key))}
        />
      ))}

      <button type="button" onClick={addRow} className="mb-3 text-sm font-semibold text-accent-dark">
        + Add line item
      </button>

      <div className="mb-3">
        <label htmlFor="loan-note" className="mb-1 block text-xs font-semibold text-text-muted">
          Note (optional)
        </label>
        <input
          id="loan-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-border px-3 py-2 text-sm text-text"
        />
      </div>

      <p className="mb-2 text-right text-sm text-text-muted">
        Total: <strong className="text-text">{peso(total)}</strong>
      </p>

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
          {isSaving ? 'Saving…' : 'Save loan'}
        </button>
      </div>
    </Modal>
  );
}
