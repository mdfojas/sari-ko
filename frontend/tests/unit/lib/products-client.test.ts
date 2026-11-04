import { describe, expect, test, vi } from 'vitest';
import {
  createProduct,
  deleteProduct,
  getProductByBarcode,
  listProducts,
  searchProducts,
  updateProduct,
} from '@/lib/products-client';
import { apiFetch, ApiError } from '@/lib/api-client';

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return { ...actual, apiFetch: vi.fn() };
});

const sampleProduct = {
  id: 1,
  name: 'Lucky Me Pancit Canton',
  other_names: ['pancit canton'],
  barcode: '4800016600011',
  sale_price: 1500,
  selected_store_price_id: 11,
  original_price: 1200,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('listProducts', () => {
  test('fetches GET /products', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([sampleProduct]);
    const result = await listProducts();
    expect(apiFetch).toHaveBeenCalledWith('/products');
    expect(result).toEqual([sampleProduct]);
  });
});

describe('searchProducts', () => {
  test('fetches GET /products/search with the query encoded', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([sampleProduct]);
    await searchProducts('pancit canton');
    expect(apiFetch).toHaveBeenCalledWith('/products/search?q=pancit%20canton');
  });
});

describe('getProductByBarcode', () => {
  test('fetches GET /products/barcode/:code', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(sampleProduct);
    const result = await getProductByBarcode('4800016600011');
    expect(apiFetch).toHaveBeenCalledWith('/products/barcode/4800016600011');
    expect(result).toEqual(sampleProduct);
  });

  test('returns null on a 404 instead of throwing', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'not found' }));
    const result = await getProductByBarcode('0000000000000');
    expect(result).toBeNull();
  });

  test('rethrows any non-404 failure', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
    await expect(getProductByBarcode('123')).rejects.toBeInstanceOf(ApiError);
  });

  // '..' is not a barcode, and as a URL path segment it is normalized away:
  // /products/barcode/.. becomes /products/, the list endpoint, whose array
  // response would then be mistaken for a single product.
  test.each(['.', '..'])('never sends the dot-segment "%s" to the server, and reports no match', async (code) => {
    (apiFetch as ReturnType<typeof vi.fn>).mockClear();
    const result = await getProductByBarcode(code);
    expect(result).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('still looks up a barcode that merely contains dots', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(sampleProduct);
    await getProductByBarcode('12.34');
    expect(apiFetch).toHaveBeenCalledWith('/products/barcode/12.34');
  });
});

describe('createProduct', () => {
  test('posts to /products with the given input', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(sampleProduct);
    const input = {
      name: 'New Product',
      barcode: null,
      other_names: [],
      sale_price: 1000,
      store_prices: [{ store_name: 'Puregold', price: 900, selected: true }],
    };
    await createProduct(input);
    expect(apiFetch).toHaveBeenCalledWith('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });
});

describe('updateProduct', () => {
  test('patches /products/:id with the given input', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(sampleProduct);
    await updateProduct(1, { sale_price: 2000 });
    expect(apiFetch).toHaveBeenCalledWith('/products/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_price: 2000 }),
    });
  });
});

describe('deleteProduct', () => {
  test('sends DELETE to /products/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await deleteProduct(1);
    expect(apiFetch).toHaveBeenCalledWith('/products/1', { method: 'DELETE' });
  });
});
