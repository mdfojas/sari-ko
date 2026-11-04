import type { CreateStorePriceInput, UpdateProductInput } from '../../queries/products/index.js';

export interface CreateProductBody {
  name?: string;
  other_names?: string[];
  barcode?: string | null;
  sale_price?: number;
  store_prices?: CreateStorePriceInput[];
}

// Prices are whole centavos stored in INTEGER columns: anything that isn't an
// integer, or is outside the column's range, would only fail later as an
// unhandled database error — so it is rejected here with a message instead.
const INT_MAX = 2_147_483_647; // ₱21,474,836.47
const MAX_PRICE_TEXT = '₱21,474,836.47';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
// Postgres refuses a NUL byte in text (error 22021), which would surface as a 500.
const hasNul = (value: unknown): boolean => typeof value === 'string' && value.includes('\u0000');
const NUL_MESSAGE = 'Text cannot contain NUL characters';

// A blank barcode is stored as null, not '': the column is UNIQUE, so a second
// blank one would collide ("barcode already exists"), and an empty string can
// never be found by a barcode lookup. A real barcode is trimmed, since lookups
// are by the bare digits (the frontend trims what it sends and searches); its
// digits, leading zeros and any inner spaces are kept exactly as sent.
export function normalizeBarcode(barcode: string | null | undefined): string | null | undefined {
  if (typeof barcode !== 'string') return barcode;
  const trimmed = barcode.trim();
  return trimmed === '' ? null : trimmed;
}

// The optional fields create and update share. Each is only checked if present.
// `other_names: null` is tolerated on create only (the query treats it as an
// empty list); on update it would try to null a NOT NULL column.
function validateOptionalFields(body: Record<string, unknown>, { nullableOtherNames = false } = {}): string | null {
  const otherNames = body.other_names;
  const otherNamesOk =
    otherNames === undefined ||
    (nullableOtherNames && otherNames === null) ||
    (Array.isArray(otherNames) && otherNames.every((n) => typeof n === 'string'));
  if (!otherNamesOk) {
    return 'other_names must be a list of text';
  }
  if (body.barcode !== undefined && body.barcode !== null && typeof body.barcode !== 'string') {
    return 'barcode must be text or null';
  }
  if (hasNul(body.barcode) || (Array.isArray(otherNames) && otherNames.some(hasNul))) {
    return NUL_MESSAGE;
  }
  if (body.sale_price !== undefined) {
    if (!isPositiveInteger(body.sale_price)) {
      return 'sale_price must be a whole number of centavos greater than ₱0';
    }
    if (body.sale_price > INT_MAX) {
      return `sale_price can be at most ${MAX_PRICE_TEXT}`;
    }
  }
  return null;
}

export function validateCreateProduct(body: CreateProductBody): string | null {
  if (!isPlainObject(body)) {
    return 'Request body must be a JSON object';
  }
  if (!isNonBlankString(body.name)) {
    return 'name is required';
  }
  if (hasNul(body.name)) {
    return NUL_MESSAGE;
  }

  const rawStorePrices: unknown = body.store_prices ?? [];
  if (!Array.isArray(rawStorePrices)) {
    return 'store_prices must be a list';
  }
  if (!rawStorePrices.every(isPlainObject)) {
    return 'Each store price must be an object with a store_name and a price';
  }
  const storePrices = rawStorePrices as unknown as CreateStorePriceInput[];

  if (storePrices.length < 1) {
    return 'At least one store price is required';
  }
  if (!storePrices.some((sp) => sp.selected)) {
    return 'One store price must be marked as selected';
  }
  if (storePrices.some((sp) => !isNonBlankString(sp.store_name) || !isPositiveInteger(sp.price))) {
    return 'Each store price needs a store name and a price greater than ₱0';
  }
  if (storePrices.some((sp) => sp.price > INT_MAX)) {
    return `A store price can be at most ${MAX_PRICE_TEXT}`;
  }
  if (storePrices.some((sp) => hasNul(sp.store_name))) {
    return NUL_MESSAGE;
  }
  return validateOptionalFields(body as Record<string, unknown>, { nullableOtherNames: true });
}

export function validateUpdateProduct(body: UpdateProductInput): string | null {
  if (!isPlainObject(body)) {
    return 'Request body must be a JSON object';
  }
  if (body.name !== undefined && !isNonBlankString(body.name)) {
    return 'name must be non-blank text';
  }
  if (hasNul(body.name)) {
    return NUL_MESSAGE;
  }
  if (
    body.selected_store_price_id !== undefined &&
    !(isPositiveInteger(body.selected_store_price_id) && body.selected_store_price_id <= INT_MAX)
  ) {
    return 'selected_store_price_id must be a positive whole number';
  }
  return validateOptionalFields(body as Record<string, unknown>);
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
