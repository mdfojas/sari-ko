'use client';

import { peso } from '@/lib/money';
import type { Product } from '@/lib/products-client';

interface ProductsTableProps {
  products: Product[];
  exactBarcodeMatchId?: number | null;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductsTable({ products, exactBarcodeMatchId, onEdit, onDelete }: ProductsTableProps) {
  if (products.length === 0) {
    return <p className="p-6 text-center text-sm text-text-muted">No products match.</p>;
  }

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
          <tr key={product.id} className="border-b border-border">
            <td className="px-4 py-3 font-semibold text-text">
              {product.name}
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
              {product.original_price !== null ? peso(product.original_price) : <span>—</span>}
            </td>
            <td className="px-4 py-3 text-text-muted">{product.selected_store_name ?? '—'}</td>
            <td className="px-4 py-3">
              {product.other_names.map((alias) => (
                <span
                  key={alias}
                  className="mr-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-muted"
                >
                  {alias}
                </span>
              ))}
            </td>
            <td className="px-4 py-3 text-right">
              <button type="button" aria-label="Edit" onClick={() => onEdit(product)} className="px-1 text-text-muted hover:text-text">
                ✏️
              </button>
              <button
                type="button"
                aria-label="Delete"
                onClick={() => onDelete(product)}
                className="px-1 text-text-muted hover:text-text"
              >
                🗑️
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
