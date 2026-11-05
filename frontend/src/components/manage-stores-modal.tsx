'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/modal';
import { extractErrorMessage } from '@/lib/error-message';
import { createStore, deleteStore, listStores, mergeStore, renameStore, type StoreSummary } from '@/lib/stores-client';

// Mirrors the backend limit (routes/stores/validation.ts).
const MAX_STORE_NAME_LENGTH = 100;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Every cache that shows a store name or a price at a store.
const AFFECTED_KEYS = [['stores'], ['store-names'], ['store-prices'], ['store-prices-at-store'], ['product'], ['products'], ['store-prices-search']];

function checkName(name: string): string | null {
  if (name === '') return 'Store name is required.';
  if (name.length > MAX_STORE_NAME_LENGTH) return `The store name can be at most ${MAX_STORE_NAME_LENGTH} characters.`;
  return null;
}

export function ManageStoresModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const storesQuery = useQuery({ queryKey: ['stores'], queryFn: listStores });
  const stores = storesQuery.data ?? [];

  function refresh() {
    for (const queryKey of AFFECTED_KEYS) queryClient.invalidateQueries({ queryKey });
  }

  // A refusal usually means the list on screen is out of date (the store was merged, deleted or
  // changed somewhere else), so the list is reloaded after a failure as well.
  function reloadStores() {
    queryClient.invalidateQueries({ queryKey: ['stores'] });
  }

  const createMutation = useMutation({
    mutationFn: (name: string) => createStore(name),
    onSuccess: (store) => {
      refresh();
      setNewName('');
      setAddError(null);
      setNotice(`Added "${store.name}".`);
    },
    onError: (err: unknown) => {
      reloadStores();
      setAddError(extractErrorMessage(err));
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ store, name }: { store: StoreSummary; name: string }) => renameStore(store.id, name),
    onSuccess: (renamed, { store }) => {
      refresh();
      setEditingId(null);
      setRowError(null);
      setNotice(`Renamed "${store.name}" to "${renamed.name}".`);
    },
    onError: (err: unknown) => {
      reloadStores();
      setRowError(extractErrorMessage(err));
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ store, target }: { store: StoreSummary; target: StoreSummary }) => mergeStore(store.id, target.id),
    onSuccess: (result, { store, target }) => {
      refresh();
      setEditingId(null);
      setRowError(null);
      setNotice(`Merged "${store.name}" into "${target.name}" (${plural(result.moved, 'price', 'prices')}).`);
    },
    onError: (err: unknown) => {
      reloadStores();
      setRowError(extractErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (store: StoreSummary) => deleteStore(store.id),
    onSuccess: (result, store) => {
      refresh();
      setConfirmingDeleteId(null);
      setRowError(null);
      setNotice(
        result.deleted === 0
          ? `Deleted "${store.name}".`
          : `Deleted "${store.name}" and its ${plural(result.deleted, 'price', 'prices')}.`,
      );
    },
    onError: (err: unknown) => {
      reloadStores();
      setRowError(extractErrorMessage(err));
    },
  });

  const busy = createMutation.isPending || renameMutation.isPending || mergeMutation.isPending || deleteMutation.isPending;
  const trimmedDraft = draft.trim();
  // Typing another store's name (in any case) means merging into it. A change of case to
  // the store's own name is just a rename.
  const mergeTarget =
    editingId === null
      ? undefined
      : stores.find((s) => s.id !== editingId && s.name.toLowerCase() === trimmedDraft.toLowerCase());

  function addStore() {
    if (busy) return;
    const name = newName.trim();
    const problem = checkName(name);
    if (problem) {
      setAddError(problem);
      return;
    }
    setAddError(null);
    setNotice(null);
    createMutation.mutate(name);
  }

  function startRename(store: StoreSummary) {
    if (busy) return;
    setEditingId(store.id);
    setDraft(store.name);
    setConfirmingDeleteId(null);
    setRowError(null);
    setNotice(null);
  }

  function startDelete(store: StoreSummary) {
    if (busy) return;
    setConfirmingDeleteId(store.id);
    setEditingId(null);
    setRowError(null);
    setNotice(null);
  }

  function cancel() {
    if (busy) return;
    setEditingId(null);
    setConfirmingDeleteId(null);
    setRowError(null);
  }

  function saveRename(store: StoreSummary) {
    if (busy) return;
    const problem = checkName(trimmedDraft);
    if (problem) {
      setRowError(problem);
      return;
    }
    setRowError(null);
    if (mergeTarget) mergeMutation.mutate({ store, target: mergeTarget });
    else renameMutation.mutate({ store, name: trimmedDraft });
  }

  const saving = renameMutation.isPending || mergeMutation.isPending;

  return (
    <Modal ariaLabel="Manage stores" wide>
      <h3 className="mb-1 text-base font-bold text-text">Manage stores</h3>
      <p className="mb-4 text-sm text-text-muted">
        Add a store, rename one everywhere at once (renaming to an existing store merges them), or delete a store you no
        longer use.
      </p>

      <div className="mb-3 flex items-start gap-2">
        <input
          aria-label="New store name"
          placeholder="Add a store, e.g. Mercury Drug"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setAddError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addStore();
          }}
          className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-sm text-text"
        />
        <button
          type="button"
          onClick={addStore}
          disabled={busy || newName.trim() === ''}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding…' : 'Add store'}
        </button>
      </div>
      {addError && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {addError}
        </p>
      )}

      {notice && (
        <p role="status" className="mb-3 text-sm text-accent-dark">
          {notice}
        </p>
      )}

      {storesQuery.isLoading ? (
        <p className="py-4 text-center text-sm text-text-muted">Loading…</p>
      ) : storesQuery.isError ? (
        <p role="alert" className="py-4 text-center text-sm text-danger">
          {extractErrorMessage(storesQuery.error)}
        </p>
      ) : stores.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">
          No stores yet. Add one above, or add a store price to a product.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-2 py-2">Store</th>
              <th className="px-2 py-2">Prices</th>
              <th className="px-2 py-2">Sale source for</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              if (editingId === store.id) {
                return (
                  <tr key={store.id} className="border-b border-border align-top">
                    <td colSpan={3} className="px-2 py-2">
                      <input
                        aria-label={`New name for ${store.name}`}
                        value={draft}
                        autoFocus
                        onChange={(e) => {
                          setDraft(e.target.value);
                          setRowError(null);
                        }}
                        className="w-full rounded border border-border px-2 py-1.5 text-sm text-text"
                      />
                      {mergeTarget && (
                        <p className="mt-1 text-xs text-text-muted">
                          A store called &quot;{mergeTarget.name}&quot; already exists, so the two will be merged.
                        </p>
                      )}
                      {rowError && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                          {rowError}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => saveRename(store)}
                        disabled={busy || trimmedDraft === store.name}
                        className="mr-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : mergeTarget ? 'Merge' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancel}
                        disabled={busy}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              }

              if (confirmingDeleteId === store.id) {
                return (
                  <tr key={store.id} className="border-b border-border align-top">
                    <td colSpan={3} className="px-2 py-2 text-sm text-text">
                      {store.price_count === 0 ? (
                        <>Delete &quot;{store.name}&quot;? It has no prices. This cannot be undone.</>
                      ) : (
                        <>
                          Delete &quot;{store.name}&quot; and its {plural(store.price_count, 'price', 'prices')}? This
                          removes them from every product and cannot be undone.
                        </>
                      )}
                      {rowError && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                          {rowError}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => !busy && deleteMutation.mutate(store)}
                        disabled={busy}
                        className="mr-2 rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete store'}
                      </button>
                      <button
                        type="button"
                        onClick={cancel}
                        disabled={busy}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              }

              const inUse = store.selected_count > 0;
              return (
                <tr key={store.id} className="border-b border-border">
                  <td className="px-2 py-2 font-semibold text-text">{store.name}</td>
                  <td className="px-2 py-2 tabular-nums text-text">{store.price_count}</td>
                  <td className="px-2 py-2 text-text-muted">
                    {inUse ? plural(store.selected_count, 'product', 'products') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Rename ${store.name}`}
                      onClick={() => startRename(store)}
                      disabled={busy}
                      className="mr-2 text-xs font-semibold text-accent-dark disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${store.name}`}
                      onClick={() => startDelete(store)}
                      disabled={busy || inUse}
                      title={
                        inUse
                          ? `This is the sale-price source for ${plural(store.selected_count, 'product', 'products')}. Select another store price for ${store.selected_count === 1 ? 'it' : 'them'} first.`
                          : undefined
                      }
                      className="text-xs font-semibold text-danger disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
          Close
        </button>
      </div>
    </Modal>
  );
}
