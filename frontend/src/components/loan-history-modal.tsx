'use client';

import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/modal';
import { extractErrorMessage } from '@/lib/error-message';
import { describeHistoryEntry } from '@/lib/loan-history';
import { getLoanHistory } from '@/lib/loans-client';
import { scopedKey, type LoanScope } from '@/lib/loan-scope';
import { getMyLoanHistory } from '@/lib/me-client';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function LoanHistoryModal({
  loanId,
  scope,
  onClose,
}: {
  loanId: number;
  scope: LoanScope;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: scopedKey(scope, 'loan-history', loanId),
    queryFn: () => (scope === 'me' ? getMyLoanHistory(loanId) : getLoanHistory(loanId)),
  });

  return (
    <Modal ariaLabel="Loan history" wide>
      <h3 className="mb-4 text-base font-bold text-text">Loan history</h3>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-danger">
          {extractErrorMessage(error)}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-text-muted">No history recorded for this loan.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-4 py-2 text-sm">
              <span className="text-text">{describeHistoryEntry(entry)}</span>
              <span className="whitespace-nowrap text-text-muted">{formatWhen(entry.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
          Close
        </button>
      </div>
    </Modal>
  );
}
