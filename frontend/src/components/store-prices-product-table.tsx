'use client';

import { peso } from '@/lib/money';
import type { Product } from '@/lib/products-client';

interface StorePricesProductTableProps {
  products: Product[];
  exactBarcodeMatchId?: number | null;
  onSelect: (product: Product) => void;
}

// The same columns as the Products table, for picking which product's store
// prices to manage. The whole row is clickable; the name is the one real
// button, so each product is a single tab stop. Its click bubbles up to the
// row's handler, so there is deliberately only one handler (no double firing).
export function StorePricesProductTable({ products, exactBarcodeMatchId, onSelect }: StorePricesProductTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Barcode</th>
          <th className="px-4 py-3">Sale price</th>
          <th className="px-4 py-3">Store price</th>
          <th className="px-4 py-3">Selected store</th>
          <th className="px-4 py-3">Aliases</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr
            key={product.id}
            onClick={() => onSelect(product)}
            className="cursor-pointer border-b border-border hover:bg-accent-light"
          >
            <td className="px-4 py-3">
              <button type="button" className="text-left font-semibold text-text">
                {product.name}
              </button>
              {exactBarcodeMatchId === product.id && (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                  exact barcode match
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-text">
              {product.barcode ? <code>{product.barcode}</code> : <span className="text-text-muted">— none —</span>}
            </td>
            <td className="px-4 py-3 font-semibold tabular-nums text-text">{peso(product.sale_price)}</td>
            <td className="px-4 py-3 tabular-nums text-text-muted">
              {typeof product.original_price === 'number' ? peso(product.original_price) : <span>—</span>}
            </td>
            <td className="px-4 py-3 text-text-muted">{product.selected_store_name ?? '—'}</td>
            <td className="px-4 py-3">
              {(product.other_names ?? []).map((alias) => (
                <span
                  key={alias}
                  className="mr-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted"
                >
                  {alias}
                </span>
              ))}
            </td>
            <td aria-hidden="true" className="px-4 py-3 text-right text-text-muted">
              ›
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
