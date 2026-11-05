import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManageStoresModal } from '@/components/manage-stores-modal';
import { createStore, deleteStore, listStores, mergeStore, renameStore, type StoreSummary } from '@/lib/stores-client';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/stores-client', () => ({
  listStores: vi.fn(),
  createStore: vi.fn(),
  renameStore: vi.fn(),
  mergeStore: vi.fn(),
  deleteStore: vi.fn(),
}));

const stores: StoreSummary[] = [
  { id: 1, name: 'Puregld', price_count: 12, selected_count: 0 },
  { id: 2, name: 'Puregold', price_count: 30, selected_count: 4 },
  { id: 3, name: 'SM', price_count: 1, selected_count: 1 },
  { id: 4, name: 'Public Market', price_count: 0, selected_count: 0 },
];

let handles: ReturnType<typeof renderModal>;

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <ManageStoresModal onClose={onClose} />
    </QueryClientProvider>
  );
  return { invalidate, onClose };
}

const rowOf = async (name: string) => (await screen.findByText(name, { selector: 'td' })).closest('tr') as HTMLElement;
const invalidatedKeys = (invalidate: { mock: { calls: unknown[][] } }) =>
  invalidate.mock.calls.map((c: unknown[]) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));
const EVERY_KEY = [['stores'], ['store-names'], ['store-prices'], ['store-prices-at-store'], ['product'], ['products'], ['store-prices-search']];
const expectEveryCacheRefreshed = async () =>
  waitFor(() => {
    const keys = invalidatedKeys(handles.invalidate);
    for (const key of EVERY_KEY) expect(keys).toContain(JSON.stringify(key));
  });

describe('ManageStoresModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listStores as ReturnType<typeof vi.fn>).mockResolvedValue(stores);
  });

  describe('listing', () => {
    test('shows each store with how many prices use it and how many products take their sale price from it', async () => {
      renderModal();
      expect(screen.getByRole('dialog', { name: /manage stores/i })).toBeInTheDocument();
      await rowOf('Puregld');
      expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Store', 'Prices', 'Sale source for', '']);

      const typo = await rowOf('Puregld');
      expect(within(typo).getByText('12')).toBeInTheDocument();
      expect(within(typo).getByText('—')).toBeInTheDocument();
      expect(within(await rowOf('Puregold')).getByText('4 products')).toBeInTheDocument();
      expect(within(await rowOf('SM')).getByText('1 product')).toBeInTheDocument();
    });

    test('lists a store that has no prices yet, with a zero count', async () => {
      renderModal();
      expect(within(await rowOf('Public Market')).getByText('0')).toBeInTheDocument();
    });

    test('with no stores, still offers Add and says so', async () => {
      (listStores as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      renderModal();
      expect(await screen.findByText(/no stores yet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/new store name/i)).toBeInTheDocument();
    });

    test('a failing load shows the error, not an empty list', async () => {
      (listStores as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'db down' }));
      renderModal();
      expect(await screen.findByRole('alert')).toHaveTextContent('db down');
      expect(screen.queryByText(/no stores yet/i)).not.toBeInTheDocument();
    });

    test('Close calls onClose', async () => {
      const { onClose } = renderModal();
      await rowOf('SM');
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('adding a store', () => {
    const addInput = () => screen.getByLabelText(/new store name/i) as HTMLInputElement;
    const addButton = () => screen.getByRole('button', { name: /^add store$/i });
    async function open() {
      handles = renderModal();
      await rowOf('SM');
    }

    test('Add is disabled while the box is empty', async () => {
      await open();
      expect(addButton()).toBeDisabled();
      fireEvent.change(addInput(), { target: { value: 'Mercury Drug' } });
      expect(addButton()).toBeEnabled();
    });

    test('an all-spaces name cannot be sent, and an over-long name is rejected before any request', async () => {
      await open();
      fireEvent.change(addInput(), { target: { value: '   ' } });
      expect(addButton()).toBeDisabled();
      fireEvent.keyDown(addInput(), { key: 'Enter' });
      expect(createStore).not.toHaveBeenCalled();

      fireEvent.change(addInput(), { target: { value: 'x'.repeat(101) } });
      fireEvent.click(addButton());
      expect(screen.getByRole('alert')).toHaveTextContent(/at most 100 characters/i);
      expect(createStore).not.toHaveBeenCalled();
    });

    test('adds the trimmed name, clears the box, confirms, and refreshes everything', async () => {
      (createStore as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 9, name: 'Mercury Drug' });
      await open();
      fireEvent.change(addInput(), { target: { value: '  Mercury Drug  ' } });
      fireEvent.click(addButton());

      await waitFor(() => expect(createStore).toHaveBeenCalledWith('Mercury Drug'));
      expect(await screen.findByRole('status')).toHaveTextContent('Added "Mercury Drug".');
      expect(addInput()).toHaveValue('');
      await expectEveryCacheRefreshed();
    });

    test("shows the backend's refusal (the store exists) and keeps what was typed", async () => {
      (createStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'A store called "Puregold" already exists' }));
      await open();
      fireEvent.change(addInput(), { target: { value: 'puregold' } });
      fireEvent.click(addButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('A store called "Puregold" already exists');
      expect(addInput()).toHaveValue('puregold');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    test('an error is gone as soon as you type again', async () => {
      (createStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      await open();
      fireEvent.change(addInput(), { target: { value: 'X' } });
      fireEvent.click(addButton());
      await screen.findByRole('alert');
      fireEvent.change(addInput(), { target: { value: 'XY' } });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('locks while the request is in flight, and sends it once', async () => {
      (createStore as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      await open();
      fireEvent.change(addInput(), { target: { value: 'X' } });
      fireEvent.click(addButton());

      expect(await screen.findByRole('button', { name: /adding/i })).toBeDisabled();
      expect(createStore).toHaveBeenCalledTimes(1);
    });

    test('the Enter key adds the store too', async () => {
      (createStore as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 9, name: 'Mercury Drug' });
      await open();
      fireEvent.change(addInput(), { target: { value: 'Mercury Drug' } });
      fireEvent.keyDown(addInput(), { key: 'Enter' });
      await waitFor(() => expect(createStore).toHaveBeenCalledWith('Mercury Drug'));
    });
  });

  describe('renaming', () => {
    async function startRename(name = 'Puregld') {
      handles = renderModal();
      await rowOf(name);
      fireEvent.click(screen.getByRole('button', { name: `Rename ${name}` }));
      return screen.getByLabelText(`New name for ${name}`) as HTMLInputElement;
    }

    test('opens an input prefilled with the current name; Save is disabled until it changes', async () => {
      const input = await startRename();
      expect(input).toHaveValue('Puregld');
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
      fireEvent.change(input, { target: { value: 'Puregold!' } });
      expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
    });

    test('a blank name and an over-long name are rejected before any request', async () => {
      const input = await startRename();
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(screen.getByRole('alert')).toHaveTextContent(/store name is required/i);
      fireEvent.change(input, { target: { value: 'x'.repeat(101) } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(screen.getByRole('alert')).toHaveTextContent(/at most 100 characters/i);
      expect(renameStore).not.toHaveBeenCalled();
    });

    test('renames that store by id, confirms, and refreshes everything that shows a store name', async () => {
      (renameStore as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, name: 'Puregold Extra' });
      const input = await startRename();
      fireEvent.change(input, { target: { value: '  Puregold Extra  ' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => expect(renameStore).toHaveBeenCalledWith(1, 'Puregold Extra'));
      expect(await screen.findByRole('status')).toHaveTextContent('Renamed "Puregld" to "Puregold Extra".');
      expect(screen.queryByLabelText(/new name for/i)).not.toBeInTheDocument();
      await expectEveryCacheRefreshed();
    });

    test('typing the other store\'s name with surrounding spaces still offers Merge', async () => {
      const input = await startRename();
      fireEvent.change(input, { target: { value: '   puregold   ' } });
      expect(screen.getByRole('button', { name: /^merge$/i })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    });

    test('a change of case only is a rename, not a merge', async () => {
      (renameStore as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 2, name: 'PUREGOLD' });
      const input = await startRename('Puregold');
      fireEvent.change(input, { target: { value: 'PUREGOLD' } });

      expect(screen.queryByText(/merged/i)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(renameStore).toHaveBeenCalledWith(2, 'PUREGOLD'));
    });

    test('typing the name of another store (any case) warns that the two will be merged, and the button says Merge', async () => {
      const input = await startRename();
      fireEvent.change(input, { target: { value: 'puregold' } });

      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      expect(screen.getByText(/merged/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^merge$/i })).toBeEnabled();
    });

    test('Merge moves the prices into that store by id, and reports how many moved', async () => {
      (mergeStore as ReturnType<typeof vi.fn>).mockResolvedValue({ moved: 12 });
      const input = await startRename();
      fireEvent.change(input, { target: { value: 'Puregold' } });
      fireEvent.click(screen.getByRole('button', { name: /^merge$/i }));

      await waitFor(() => expect(mergeStore).toHaveBeenCalledWith(1, 2));
      expect(renameStore).not.toHaveBeenCalled();
      expect(await screen.findByRole('status')).toHaveTextContent('Merged "Puregld" into "Puregold" (12 prices).');
      await expectEveryCacheRefreshed();
    });

    test('a merged single price is described in the singular', async () => {
      (mergeStore as ReturnType<typeof vi.fn>).mockResolvedValue({ moved: 1 });
      const input = await startRename('SM');
      fireEvent.change(input, { target: { value: 'Puregold' } });
      fireEvent.click(screen.getByRole('button', { name: /^merge$/i }));
      expect(await screen.findByRole('status')).toHaveTextContent('(1 price).');
    });

    test("shows the backend's refusal (a merge conflict) inside the row, keeping the edit open", async () => {
      (mergeStore as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(409, { error: '3 products already have a price at "Puregold".' })
      );
      const input = await startRename();
      fireEvent.change(input, { target: { value: 'Puregold' } });
      fireEvent.click(screen.getByRole('button', { name: /^merge$/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('3 products already have a price at "Puregold".');
      expect(screen.getByLabelText('New name for Puregld')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    test('Cancel leaves the name as it was, and clears the error', async () => {
      (renameStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(500, { error: 'boom' }));
      const input = await startRename();
      fireEvent.change(input, { target: { value: 'Other' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByLabelText(/new name for/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Puregld', { selector: 'td' })).toBeInTheDocument();
    });

    test('locks the buttons while the request is in flight, and sends it once', async () => {
      (renameStore as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      const input = await startRename();
      fireEvent.change(input, { target: { value: 'Other' } });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
      expect(renameStore).toHaveBeenCalledTimes(1);
    });

    test('only one store can be edited at a time', async () => {
      await startRename('Puregld');
      fireEvent.click(screen.getByRole('button', { name: 'Rename SM' }));
      expect(screen.queryByLabelText('New name for Puregld')).not.toBeInTheDocument();
      expect(screen.getByLabelText('New name for SM')).toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    async function startDelete(name = 'Puregld') {
      handles = renderModal();
      await rowOf(name);
      fireEvent.click(screen.getByRole('button', { name: `Delete ${name}` }));
    }

    test("is disabled, with the reason, for a store that is some product's sale-price source", async () => {
      renderModal();
      await rowOf('Puregold');
      const button = screen.getByRole('button', { name: 'Delete Puregold' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringMatching(/sale-price source for 4 products/i));
      fireEvent.click(button);
      expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    });

    test('asks for confirmation, naming the store and how many prices go with it; Cancel keeps it', async () => {
      await startDelete();
      expect(screen.getByText(/Delete "Puregld" and its 12 prices\?/)).toBeInTheDocument();
      expect(screen.getByText(/every product/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByText(/Delete "Puregld" and its/)).not.toBeInTheDocument();
      expect(deleteStore).not.toHaveBeenCalled();
    });

    test('a store with no prices says so, and deletes without any price warning', async () => {
      (deleteStore as ReturnType<typeof vi.fn>).mockResolvedValue({ deleted: 0 });
      await startDelete('Public Market');
      expect(screen.getByText(/Delete "Public Market"\? It has no prices\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^delete store$/i }));

      await waitFor(() => expect(deleteStore).toHaveBeenCalledWith(4));
      expect(await screen.findByRole('status')).toHaveTextContent('Deleted "Public Market".');
    });

    test('confirming deletes it by id, says how many prices went, and refreshes everything', async () => {
      (deleteStore as ReturnType<typeof vi.fn>).mockResolvedValue({ deleted: 12 });
      await startDelete();
      fireEvent.click(screen.getByRole('button', { name: /^delete store$/i }));

      await waitFor(() => expect(deleteStore).toHaveBeenCalledWith(1));
      expect(await screen.findByRole('status')).toHaveTextContent('Deleted "Puregld" and its 12 prices.');
      await expectEveryCacheRefreshed();
    });

    test("shows the backend's refusal inside the row and keeps the confirmation open", async () => {
      (deleteStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: '"Puregld" is the sale-price source for 1 product.' }));
      await startDelete();
      fireEvent.click(screen.getByRole('button', { name: /^delete store$/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('sale-price source for 1 product');
      expect(screen.getByRole('button', { name: /^delete store$/i })).toBeEnabled();
    });

    test('locks while the delete is in flight, and sends it once', async () => {
      (deleteStore as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      await startDelete();
      fireEvent.click(screen.getByRole('button', { name: /^delete store$/i }));

      expect(await screen.findByRole('button', { name: /deleting/i })).toBeDisabled();
      expect(deleteStore).toHaveBeenCalledTimes(1);
    });

    test('starting a rename closes an open delete confirmation', async () => {
      await startDelete('Puregld');
      fireEvent.click(screen.getByRole('button', { name: 'Rename SM' }));
      expect(screen.queryByText(/Delete "Puregld" and its/)).not.toBeInTheDocument();
    });
  });

  // A refusal usually means the list on screen is out of date (the store was merged, deleted or
  // changed somewhere else), so it is reloaded after a failure as well.
  describe('after a failed action', () => {
    const storesFetches = () => (listStores as ReturnType<typeof vi.fn>).mock.calls.length;
    const stale = (invalidate: { mock: { calls: unknown[][] } }) =>
      invalidate.mock.calls.map((c: unknown[]) => JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey));

    test.each([
      ['adding', async () => {
        (createStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'exists' }));
        fireEvent.change(screen.getByLabelText(/new store name/i), { target: { value: 'X' } });
        fireEvent.click(screen.getByRole('button', { name: /^add store$/i }));
      }],
      ['renaming', async () => {
        (renameStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(404, { error: 'Store not found' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rename SM' }));
        fireEvent.change(screen.getByLabelText('New name for SM'), { target: { value: 'SM2' } });
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      }],
      ['merging', async () => {
        (mergeStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'conflict' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rename Puregld' }));
        fireEvent.change(screen.getByLabelText('New name for Puregld'), { target: { value: 'Puregold' } });
        fireEvent.click(screen.getByRole('button', { name: /^merge$/i }));
      }],
      ['deleting', async () => {
        (deleteStore as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError(409, { error: 'busy' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Puregld' }));
        fireEvent.click(screen.getByRole('button', { name: /^delete store$/i }));
      }],
    ])('%s reloads the list of stores', async (_label, act) => {
      handles = renderModal();
      await rowOf('SM');
      const before = storesFetches();
      await act();

      await screen.findByRole('alert');
      expect(stale(handles.invalidate)).toContain(JSON.stringify(['stores']));
      await waitFor(() => expect(storesFetches()).toBeGreaterThan(before));
    });
  });
});
