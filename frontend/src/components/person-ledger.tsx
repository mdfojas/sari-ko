'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoanLineItems } from '@/components/loan-line-items';
import { extractErrorMessage } from '@/lib/error-message';
import { peso } from '@/lib/money';
import { scopedKey } from '@/lib/loan-scope';
import { getMyLedger } from '@/lib/me-client';
import { getLedger } from '@/lib/persons-client';

// Staff view of one person's ledger, or (scope "me") the signed-in customer's own,
// which is read-only and needs no person id.
type PersonLedgerProps = { scope?: 'staff'; personId: number } | { scope: 'me'; personId?: undefined };

export function PersonLedger(props: PersonLedgerProps) {
  const scope = props.scope ?? 'staff';
  const personId = props.personId;
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: scope === 'me' ? scopedKey('me', 'ledger') : ['ledger', personId],
    queryFn: () => (scope === 'me' ? getMyLedger() : getLedger(personId as number)),
  });

  if (isLoading) return <p className="p-4 text-sm text-text-muted">Loading…</p>;
  if (isError) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {extractErrorMessage(error)}
      </p>
    );
  }
  if (!data || data.length === 0) {
    return <p className="p-4 text-sm text-text-muted">No loans or payments yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
          <th className="w-8 px-3 py-2" />
          <th className="px-3 py-2">Date</th>
          <th className="px-3 py-2">Description</th>
          <th className="px-3 py-2 text-right">Amount</th>
          <th className="px-3 py-2 text-right">Balance</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => {
          const isLoan = entry.type === 'loan';
          const isExpanded = isLoan && expandedLoanId === entry.id;
          return (
            <Fragment key={`${entry.type}-${entry.id}`}>
              <tr className="border-t border-border">
                <td className="px-3 py-2">
                  {isLoan && (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} items for loan ${entry.id}`}
                      onClick={() => setExpandedLoanId(isExpanded ? null : entry.id)}
                      className="text-text-muted"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {new Date(entry.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td className="px-3 py-2 text-text">{entry.description || (isLoan ? 'Loan' : 'Payment')}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${isLoan ? 'text-text' : 'text-accent-dark'}`}>
                  {isLoan ? `+${peso(entry.amount)}` : `−${peso(Math.abs(entry.amount))}`}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-text">{peso(entry.running_balance)}</td>
              </tr>
              {isExpanded && (
                <tr>
                  <td />
                  <td colSpan={4} className="px-3">
                    {scope === 'me' ? (
                      <LoanLineItems loanId={entry.id} scope="me" />
                    ) : (
                      <LoanLineItems loanId={entry.id} personId={personId as number} scope="staff" />
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
