import { describe, expect, test } from 'vitest';
import { applyProductFilter } from '@/lib/product-filters';
import type { Product } from '@/lib/products-client';

const withBarcode = { id: 1, barcode: '123', selected_store_price_id: 10 } as Product;
const noBarcode = { id: 2, barcode: null, selected_store_price_id: 20 } as Product;

const products = [withBarcode, noBarcode];

describe('applyProductFilter', () => {
  test('"all" returns every product unchanged', () => {
    expect(applyProductFilter(products, 'all')).toEqual(products);
  });

  test('"has-barcode" keeps only products with a non-null barcode', () => {
    expect(applyProductFilter(products, 'has-barcode')).toEqual([withBarcode]);
  });
});
