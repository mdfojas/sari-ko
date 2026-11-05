'use client';

import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CredentialResultModal } from '@/components/credential-result-modal';
import { LoanFormModal } from '@/components/loan-form-modal';
import { PaymentFormModal } from '@/components/payment-form-modal';
import { PersonLedger } from '@/components/person-ledger';
import { PersonModal } from '@/components/person-modal';
import { TopbarSlot } from '@/components/topbar-slot';
import { useAuth } from '@/contexts/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { createAccount } from '@/lib/accounts-client';
import { extractErrorMessage } from '@/lib/error-message';
import { createLoan, type CreateLoanInput } from '@/lib/loans-client';
import { peso } from '@/lib/money';
import { createPayment, type PaymentInput } from '@/lib/payments-client';
import {
  createPerson,
  deletePerson,
  getLedger,
  listPersons,
  searchPersons,
  updatePerson,
  type Person,
  type PersonInput,
} from '@/lib/persons-client';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/loans'];
const SEARCH_DEBOUNCE_MS = 300;

type BalanceFilter = 'all' | 'has-balance' | 'settled';
const FILTER_LABELS: Record<BalanceFilter, string> = { all: 'All', 'has-balance': 'Has balance', settled: 'Settled' };

function applyFilter(persons: Person[], filter: BalanceFilter): Person[] {
  if (filter === 'has-balance') return persons.filter((p) => p.balance !== 0);
  if (filter === 'settled') return persons.filter((p) => p.balance === 0);
  return persons;
}

function BalanceCell({ balance }: { balance: number }) {
  if (balance === 0) return <span className="text-text-muted">Settled</span>;
  if (balance < 0) return <span className="text-accent-dark">Credit {peso(-balance)}</span>;
  return <span className="font-semibold text-text">{peso(balance)}</span>;
}

interface Credential {
  username: string;
  password: string;
}

export default function LoansPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<BalanceFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [creatingPerson, setCreatingPerson] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loanFor, setLoanFor] = useState<Person | null>(null);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [paymentFor, setPaymentFor] = useState<Person | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);

  const query = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS).trim();
  const personsQuery = useQuery({
    queryKey: ['persons', query],
    queryFn: () => (query ? searchPersons(query) : listPersons()),
  });
  const ledgerQuery = useQuery({
    queryKey: ['ledger', profileId],
    queryFn: () => getLedger(profileId as number),
    enabled: profileId !== null,
  });

  // The persons list carries each person's balance, so anything that moves
  // money refreshes it, and that person's ledger.
  function refreshPerson(personId: number) {
    queryClient.invalidateQueries({ queryKey: ['persons'] });
    queryClient.invalidateQueries({ queryKey: ['ledger', personId] });
  }

  const createPersonMutation = useMutation({
    mutationFn: (input: PersonInput) => createPerson(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      setCreatingPerson(false);
      setProfileError(null);
    },
    onError: (err: unknown) => setProfileError(extractErrorMessage(err)),
  });

  const updatePersonMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PersonInput }) => updatePerson(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      setProfileId(null);
      setProfileError(null);
    },
    onError: (err: unknown) => setProfileError(extractErrorMessage(err)),
  });

  const deletePersonMutation = useMutation({
    mutationFn: (id: number) => deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err)),
  });

  // gcTime 0: see accounts/page.tsx — the generated password must not linger in the cache.
  const createAccountMutation = useMutation({
    gcTime: 0,
    mutationFn: (person: Person) => createAccount({ role: 'customer', person_id: person.id }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setProfileId(null);
      setProfileError(null);
      setCredential({ username: created.username, password: created.password });
    },
    onError: (err: unknown) => setProfileError(extractErrorMessage(err)),
  });

  const loanMutation = useMutation({
    mutationFn: ({ personId, input }: { personId: number; input: CreateLoanInput }) => createLoan(personId, input),
    onSuccess: (_loan, { personId }) => {
      refreshPerson(personId);
      setExpandedId(personId);
      setLoanFor(null);
      setLoanError(null);
    },
    onError: (err: unknown) => setLoanError(extractErrorMessage(err)),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ personId, input }: { personId: number; input: PaymentInput }) => createPayment(personId, input),
    onSuccess: (_payment, { personId }) => {
      refreshPerson(personId);
      setExpandedId(personId);
      setPaymentFor(null);
      setPaymentError(null);
    },
    onError: (err: unknown) => setPaymentError(extractErrorMessage(err)),
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  const persons = personsQuery.data ?? [];
  const shown = applyFilter(persons, filter);
  const profile = persons.find((p) => p.id === profileId) ?? null;

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">Loans</h1>
        <input
          aria-label="Search people"
          placeholder="Search by name..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-64 rounded border border-border px-3 py-2 text-sm"
        />
        {(Object.keys(FILTER_LABELS) as BalanceFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === f ? 'border-accent bg-accent-light text-accent-dark' : 'border-border text-text-muted'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setProfileError(null);
            setCreatingPerson(true);
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white"
        >
          + New Person
        </button>
      </TopbarSlot>

      <div className="rounded-lg border border-border bg-card">
        {personsQuery.isLoading ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : personsQuery.isError ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            {extractErrorMessage(personsQuery.error)}
          </p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">No people match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((person) => {
                const isExpanded = expandedId === person.id;
                return (
                  <Fragment key={person.id}>
                    <tr className="border-b border-border">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} ledger for ${person.name}`}
                          onClick={() => setExpandedId(isExpanded ? null : person.id)}
                          className="text-text-muted"
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text">{person.name}</span>
                        {person.contact && <span className="ml-2 text-xs text-text-muted">{person.contact}</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <BalanceCell balance={person.balance} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            person.has_account ? 'bg-accent text-white' : 'border border-border text-text-muted'
                          }`}
                        >
                          {person.has_account ? 'Has account' : 'No account'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          aria-label={`Add loan for ${person.name}`}
                          onClick={() => {
                            setLoanError(null);
                            setLoanFor(person);
                          }}
                          className="mr-3 text-xs font-semibold text-accent-dark"
                        >
                          + Loan
                        </button>
                        <button
                          type="button"
                          aria-label={`Add payment for ${person.name}`}
                          onClick={() => {
                            setPaymentError(null);
                            setPaymentFor(person);
                          }}
                          className="mr-3 text-xs font-semibold text-accent-dark"
                        >
                          + Payment
                        </button>
                        <button
                          type="button"
                          aria-label={`Profile of ${person.name}`}
                          onClick={() => {
                            setProfileError(null);
                            setProfileId(person.id);
                          }}
                          className="text-xs font-semibold text-text-muted"
                        >
                          Profile
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-border bg-bg">
                        <td />
                        <td colSpan={4}>
                          <PersonLedger personId={person.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {creatingPerson && (
        <PersonModal
          onSave={(input) => createPersonMutation.mutate(input)}
          onClose={() => {
            setCreatingPerson(false);
            setProfileError(null);
          }}
          error={profileError}
          isSaving={createPersonMutation.isPending}
        />
      )}

      {profile && (
        <PersonModal
          person={profile}
          // null until the ledger loads — history is unknown, so Delete stays disabled.
          historyUnavailable={ledgerQuery.isError}
          hasLedgerHistory={ledgerQuery.data ? ledgerQuery.data.length > 0 : null}
          onSave={(input) => updatePersonMutation.mutate({ id: profile.id, input })}
          onDelete={() => {
            setDeleteError(null);
            setDeleting(profile);
            setProfileId(null);
          }}
          onCreateAccount={() => createAccountMutation.mutate(profile)}
          onClose={() => {
            setProfileId(null);
            setProfileError(null);
          }}
          error={profileError}
          isSaving={updatePersonMutation.isPending || createAccountMutation.isPending}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this person?"
          body={`"${deleting.name}" will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete Person"
          error={deleteError}
          isConfirming={deletePersonMutation.isPending}
          onConfirm={() => deletePersonMutation.mutate(deleting.id)}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}

      {loanFor && (
        <LoanFormModal
          personName={loanFor.name}
          onSave={(input) => loanMutation.mutate({ personId: loanFor.id, input })}
          onClose={() => {
            setLoanFor(null);
            setLoanError(null);
          }}
          error={loanError}
          isSaving={loanMutation.isPending}
        />
      )}

      {paymentFor && (
        <PaymentFormModal
          personName={paymentFor.name}
          balance={paymentFor.balance}
          onSave={(input) => paymentMutation.mutate({ personId: paymentFor.id, input })}
          onClose={() => {
            setPaymentFor(null);
            setPaymentError(null);
          }}
          error={paymentError}
          isSaving={paymentMutation.isPending}
        />
      )}

      {credential && (
        <CredentialResultModal
          title="Account created"
          username={credential.username}
          password={credential.password}
          onClose={() => {
            setCredential(null);
            // The mutation cache would otherwise keep the generated password in memory.
            createAccountMutation.reset();
          }}
        />
      )}
    </>
  );
}
