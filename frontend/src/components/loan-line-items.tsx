'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoanHistoryModal } from '@/components/loan-history-modal';
import { extractErrorMessage } from '@/lib/error-message';
import { deleteLineItem, deleteLoan, getLoan, listLineItems, type LineItem } from '@/lib/loans-client';
import { peso } from '@/lib/money';

interface LoanLineItemsProps {
  loanId: number;
  personId: number;
}

export function LoanLineItems({ loanId, personId }: LoanLineItemsProps) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<LineItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loanQuery = useQuery({ queryKey: ['loan', loanId], queryFn: () => getLoan(loanId) });
  const itemsQuery = useQuery({ queryKey: ['loan-line-items', loanId], queryFn: () => listLineItems(loanId) });

  const items = itemsQuery.data ?? [];
  // The backend refuses to delete a loan's last line item (it would leave an
  // empty loan), so the only way to remove it is to delete the whole loan.
  // Checked against the item itself, not just the count: if the list changed
  // while the dialog was open, a stale count must not delete the whole loan.
  const removingOnlyItem = removing !== null && items.length === 1 && items[0].id === removing.id;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['loan-line-items', loanId] });
    queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
    queryClient.invalidateQueries({ queryKey: ['ledger', personId] });
    // The persons list carries each person's balance.
    queryClient.invalidateQueries({ queryKey: ['persons'] });
  }

  const removeMutation = useMutation({
    mutationFn: (item: LineItem) =>
      items.length === 1 && items[0].id === item.id ? deleteLoan(loanId) : deleteLineItem(item.id),
    onSuccess: () => {
      refresh();
      setRemoving(null);
      setRemoveError(null);
    },
    onError: (err: unknown) => setRemoveError(extractErrorMessage(err)),
  });

  const loadError = loanQuery.isError ? loanQuery.error : itemsQuery.isError ? itemsQuery.error : null;

  if (loanQuery.isLoading || itemsQuery.isLoading) {
    return <p className="py-2 text-sm text-text-muted">Loading…</p>;
  }
  if (loadError) {
    return (
      <p role="alert" className="py-2 text-sm text-danger">
        {extractErrorMessage(loadError)}
      </p>
    );
  }

  return (
    <div className="py-2">
      <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
        <span>
          Last updated{' '}
          {loanQuery.data &&
            new Date(loanQuery.data.updated_at).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
        </span>
        <button type="button" onClick={() => setShowHistory(true)} className="font-semibold text-accent-dark">
          View history
        </button>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="py-2 pr-3 text-text">{item.description}</td>
              <td className="py-2 pr-3">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                  {item.unit_price !== null ? 'Catalog' : 'Freeform'}
                </span>
              </td>
              <td className="py-2 pr-3 text-text-muted">
                {item.unit_price !== null && item.quantity !== null && `${item.quantity} × ${peso(item.unit_price)}`}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-text">{peso(item.amount)}</td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  aria-label={`Delete ${item.description}`}
                  onClick={() => {
                    setRemoveError(null);
                    setRemoving(item);
                  }}
                  className="px-1 text-text-muted hover:text-text"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {removing && (
        <ConfirmDialog
          title={removingOnlyItem ? 'Delete this loan?' : 'Delete this line item?'}
          body={
            removingOnlyItem
              ? `"${removing.description}" is the only line item on this loan, so removing it deletes the whole loan. This cannot be undone.`
              : `"${removing.description}" (${peso(removing.amount)}) will be removed from this loan. This cannot be undone.`
          }
          confirmLabel={removingOnlyItem ? 'Delete Loan' : 'Delete Item'}
          error={removeError}
          isConfirming={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(removing)}
          onCancel={() => {
            setRemoving(null);
            setRemoveError(null);
          }}
        />
      )}

      {showHistory && <LoanHistoryModal loanId={loanId} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
