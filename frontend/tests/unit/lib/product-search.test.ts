import { describe, expect, test, vi } from 'vitest';
import { resolveProductSearch } from '@/lib/product-search';
import { getProductByBarcode, listProducts, searchProducts } from '@/lib/products-client';

vi.mock('@/lib/products-client', () => ({
  listProducts: vi.fn(),
  searchProducts: vi.fn(),
  getProductByBarcode: vi.fn(),
}));

const exactProduct = { id: 1, name: 'Lucky Me', barcode: '4800016600011' };
const fuzzyMatches = [{ id: 2, name: 'Coca-Cola', barcode: null }];
const allProducts = [{ id: 3, name: 'Everything' }];

describe('resolveProductSearch', () => {
  test('lists all products when the query is blank', async () => {
    (listProducts as ReturnType<typeof vi.fn>).mockResolvedValue(allProducts);

    const result = await resolveProductSearch('');

    expect(result).toEqual({ matches: allProducts, exact: null });
    expect(getProductByBarcode).not.toHaveBeenCalled();
    expect(searchProducts).not.toHaveBeenCalled();
  });

  test('lists all products when the query is only whitespace', async () => {
    (listProducts as ReturnType<typeof vi.fn>).mockResolvedValue(allProducts);

    const result = await resolveProductSearch('   ');

    expect(result).toEqual({ matches: allProducts, exact: null });
  });

  test('resolves an exact barcode match and returns only that product, ignoring name matching', async () => {
    (getProductByBarcode as ReturnType<typeof vi.fn>).mockResolvedValue(exactProduct);

    const result = await resolveProductSearch('4800016600011');

    expect(result).toEqual({ matches: [exactProduct], exact: exactProduct });
    expect(searchProducts).not.toHaveBeenCalled();
  });

  test('falls back to fuzzy name/alias search when there is no exact barcode match', async () => {
    (getProductByBarcode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (searchProducts as ReturnType<typeof vi.fn>).mockResolvedValue(fuzzyMatches);

    const result = await resolveProductSearch('coca');

    expect(result).toEqual({ matches: fuzzyMatches, exact: null });
    expect(getProductByBarcode).toHaveBeenCalledWith('coca');
    expect(searchProducts).toHaveBeenCalledWith('coca');
  });
});
