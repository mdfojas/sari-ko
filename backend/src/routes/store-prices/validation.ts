import { INT_MAX, isPlainObject, MAX_AMOUNT_TEXT } from '../../shared/validation.js';
import { validateStoreName } from '../stores/validation.js';

export interface CreateStorePriceBody {
  store_name?: string;
  price?: number;
}

function validatePrice(price: unknown): string | null {
  if (typeof price !== 'number' || !Number.isInteger(price)) return 'price must be a whole number of centavos';
  if (price <= 0) return 'price must be greater than 0';
  if (price > INT_MAX) return `price can be at most ${MAX_AMOUNT_TEXT}`;
  return null;
}

export function validateCreateStorePrice(body: CreateStorePriceBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (body.store_name === undefined || body.price === undefined) {
    return 'store_name and price are required';
  }
  return validateStoreName(body.store_name) ?? validatePrice(body.price);
}

// Each field is optional, but one that is present must be valid. (A price of 0 used
// to reach the database CHECK and come back as a 500.)
export function validateUpdateStorePrice(body: CreateStorePriceBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (body.store_name !== undefined) {
    const error = validateStoreName(body.store_name);
    if (error) return error;
  }
  if (body.price !== undefined) {
    const error = validatePrice(body.price);
    if (error) return error;
  }
  return null;
}

export function hasStorePriceUpdate(body: CreateStorePriceBody): boolean {
  return body.store_name !== undefined || body.price !== undefined;
}
