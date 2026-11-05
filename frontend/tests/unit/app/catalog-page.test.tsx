import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopbarProvider } from '@/contexts/topbar-context';
import { Topbar } from '@/components/topbar';
import CatalogPage from '@/app/(app)/catalog/page';
import { useAuth } from '@/contexts/auth-context';
import { listProducts, type Product } from '@/lib/products-client';
import { ApiError } from '@/lib/api-client';
import type { Role } from '@/lib/auth-types';

const replace = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/products-client', () => ({ listProducts: vi.fn() }));

// What the backend returns to a customer: the pick-list has no store-price fields at all.
const customerShaped = (id: number, name: string, sale_price: number, other_names: string[] = []) =>
  ({ id, name, other_names, barcode: `48000${id}`, sale_price, created_at: '', updated_at: '' }) as unknown as Product;

const products = [
  customerShaped(1, 'Coca-Cola 1.5L', 8500, ['Coke']),
  customerShaped(2, 'Lucky Me Pancit Canton', 1800),
  customerShaped(3, 'Safeguard Soap', 3200),
];

function signInAs(role: Role) {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 3, username: 'juan', role, personId: role === 'customer' ? 1 : null },
    isLoading: false,
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TopbarProvider>
        <Topbar />
        <CatalogPage />
      </TopbarProvider>
    </QueryClientProvider>
  );
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs('customer');
    (listProducts as ReturnType<typeof vi.fn>).mockResolvedValue(products);
  });

  test.each<Role>(['admin', 'store_owner'])('redirects a %s to their own landing page and renders nothing', async (role) => {
    signInAs(role);
    renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/products'));
    expect(listProducts).not.toHaveBeenCalled();
  });

  test('lists each product with its name and sale price, and nothing else', async () => {
    renderPage();
    const row = (await screen.findByText('Coca-Cola 1.5L')).closest('tr') as HTMLElement;
    expect(within(row).getByText('₱85.00')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Sale price']);
  });

  test('never renders a barcode, a store price or any management control', async () => {
    renderPage();
    await screen.findByText('Coca-Cola 1.5L');
    expect(screen.queryByText('480001')).not.toBeInTheDocument();
    expect(screen.queryByText(/store/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/original/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/barcode/i)).not.toBeInTheDocument();
    for (const name of [/add/i, /edit/i, /delete/i, /scan/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  test('filters by name as you type, and by an alternative name too', async () => {
    renderPage();
    await screen.findByText('Coca-Cola 1.5L');
    fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'soap' } });
    expect(screen.getByText('Safeguard Soap')).toBeInTheDocument();
    expect(screen.queryByText('Coca-Cola 1.5L')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'coke' } });
    expect(screen.getByText('Coca-Cola 1.5L')).toBeInTheDocument();
  });

  test('says so when nothing matches', async () => {
    renderPage();
    await screen.findByText('Coca-Cola 1.5L');
    fireEvent.change(screen.getByLabelText(/search products/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/no products match/i)).toBeInTheDocument();
  });

  test('says so when the store has no products yet', async () => {
    (listProducts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/no products yet/i)).toBeInTheDocument();
  });

  test('a failing load shows the error, not an empty catalog', async () => {
    (listProducts as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('db down');
    expect(screen.queryByText(/no products/i)).not.toBeInTheDocument();
  });
});
