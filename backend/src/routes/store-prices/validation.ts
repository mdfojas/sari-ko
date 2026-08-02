export interface CreateStorePriceBody {
  store_name?: string;
  price?: number;
}

export function validateCreateStorePrice(body: CreateStorePriceBody): string | null {
  if (!body.store_name || body.price === undefined) {
    return 'store_name and price are required';
  }
  return null;
}

export function hasStorePriceUpdate(body: CreateStorePriceBody): boolean {
  return body.store_name !== undefined || body.price !== undefined;
}
