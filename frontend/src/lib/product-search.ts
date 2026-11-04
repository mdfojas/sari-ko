import { getProductByBarcode, listProducts, searchProducts, type Product } from './products-client';

export interface ProductSearchResult {
  matches: Product[];
  exact: Product | null;
}

// If a query exactly matches a barcode, that wins over any name/alias
// match — a barcode (especially from a scan) is exact, a name is fuzzy.
export async function resolveProductSearch(query: string): Promise<ProductSearchResult> {
  const q = query.trim();
  if (!q) {
    return { matches: await listProducts(), exact: null };
  }

  const exact = await getProductByBarcode(q);
  if (exact) {
    return { matches: [exact], exact };
  }

  return { matches: await searchProducts(q), exact: null };
}
