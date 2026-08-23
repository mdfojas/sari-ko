import type { Product } from './products-client';

export type ProductFilter = 'all' | 'has-barcode';

export function applyProductFilter(products: Product[], filter: ProductFilter): Product[] {
  if (filter === 'has-barcode') return products.filter((p) => p.barcode);
  return products;
}
