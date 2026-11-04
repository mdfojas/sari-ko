'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoanLineItems } from '@/components/loan-line-items';
import { extractErrorMessage } from '@/lib/error-message';
import { peso } from '@/lib/money';
import { getLedger } from '@/lib/persons-client';

export function PersonLedger({ personId }: { personId: number }) {
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ledger', personId],
    queryFn: () => getLedger(personId),
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
                    <LoanLineItems loanId={entry.id} personId={personId} />
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
