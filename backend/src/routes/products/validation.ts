import type { CreateStorePriceInput, UpdateProductInput } from '../../queries/products/index.js';

export interface CreateProductBody {
  name?: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  store_prices?: CreateStorePriceInput[];
}

export function validateCreateProduct(body: CreateProductBody): string | null {
  const storePrices = body.store_prices ?? [];

  if (!body.name) {
    return 'name is required';
  }
  if (storePrices.length < 1) {
    return 'At least one store price is required';
  }
  if (!storePrices.some((sp) => sp.selected)) {
    return 'One store price must be marked as selected';
  }
  return null;
}

export function hasProductUpdate(body: UpdateProductInput): boolean {
  return (
    body.name !== undefined ||
    body.other_names !== undefined ||
    body.barcode !== undefined ||
    body.sale_price !== undefined ||
    body.selected_store_price_id !== undefined
  );
}
