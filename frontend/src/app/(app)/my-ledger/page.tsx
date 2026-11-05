'use client';

import { useQuery } from '@tanstack/react-query';
import { PersonLedger } from '@/components/person-ledger';
import { TopbarSlot } from '@/components/topbar-slot';
import { useAuth } from '@/contexts/auth-context';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { extractErrorMessage } from '@/lib/error-message';
import { getMyBalance } from '@/lib/me-client';
import { peso } from '@/lib/money';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/my-ledger'];

// The customer's landing page. Read-only by design: everything comes from the
// /me endpoints, which resolve the person from the signed-in account, so there
// is no way to ask for anyone else's data and nothing here can change it.
export default function MyLedgerPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const balanceQuery = useQuery({ queryKey: ['me', 'balance'], queryFn: getMyBalance, enabled: user?.role === 'customer' });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  const balance = balanceQuery.data;

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">My Ledger</h1>
      </TopbarSlot>

      <div className="mb-5 inline-block min-w-56 rounded-lg border border-border bg-card px-5 py-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Current balance</div>
        {balanceQuery.isLoading ? (
          <div className="text-sm text-text-muted">Loading…</div>
        ) : balanceQuery.isError ? (
          <p role="alert" className="text-sm text-danger">
            {extractErrorMessage(balanceQuery.error)}
          </p>
        ) : balance !== undefined ? (
          <>
            <div className={`text-2xl font-bold tabular-nums ${balance > 0 ? 'text-danger' : 'text-text'}`}>
              {peso(Math.abs(balance))}
            </div>
            {balance === 0 && <div className="text-xs text-text-muted">Settled</div>}
            {balance < 0 && <div className="text-xs text-text-muted">Credit — you have overpaid</div>}
          </>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <PersonLedger scope="me" />
      </div>
    </>
  );
}
