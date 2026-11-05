'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopbarSlot } from '@/components/topbar-slot';
import { useAuth } from '@/contexts/auth-context';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { extractErrorMessage } from '@/lib/error-message';
import { peso } from '@/lib/money';
import { listProducts } from '@/lib/products-client';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/catalog'];

// Read-only price list for customers: name and sale price only. The backend
// already strips everything else from a customer's product responses; this page
// also never asks for or renders any management or store-price UI.
export default function CatalogPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const productsQuery = useQuery({
    queryKey: ['me', 'catalog'],
    queryFn: listProducts,
    enabled: user?.role === 'customer',
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  const products = productsQuery.data ?? [];
  const needle = searchText.trim().toLowerCase();
  const shown = products.filter(
    (p) => !needle || p.name.toLowerCase().includes(needle) || p.other_names.some((n) => n.toLowerCase().includes(needle)),
  );

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">Products</h1>
        <input
          aria-label="Search products"
          placeholder="Search by name..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-64 rounded border border-border px-3 py-2 text-sm"
        />
      </TopbarSlot>

      <div className="rounded-lg border border-border bg-card">
        {productsQuery.isLoading ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : productsQuery.isError ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            {extractErrorMessage(productsQuery.error)}
          </p>
        ) : products.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">No products yet.</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">No products match your search.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Sale price</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((product) => (
                <tr key={product.id} className="border-b border-border">
                  <td className="px-4 py-3 text-text">{product.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text">{peso(product.sale_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
