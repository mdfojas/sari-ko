'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountFormModal } from '@/components/account-form-modal';
import { AccountProfileModal } from '@/components/account-profile-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CredentialResultModal } from '@/components/credential-result-modal';
import { ResetPasswordModal } from '@/components/reset-password-modal';
import { RoleBadge } from '@/components/role-badge';
import { TopbarSlot } from '@/components/topbar-slot';
import { useAuth } from '@/contexts/auth-context';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { canManageAccountOfRole, isLastAdmin } from '@/lib/account-permissions';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  type Account,
  type CreateAccountInput,
} from '@/lib/accounts-client';
import { extractErrorMessage } from '@/lib/error-message';
import { listPersons } from '@/lib/persons-client';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/accounts'];
const SESSIONS_NOTE = 'Existing sessions stay valid until they expire naturally — a password reset does not sign anyone out.';

interface Credential {
  title: string;
  username?: string;
  password: string;
  note?: string;
}

export default function AccountsPage() {
  useRequireRole(ALLOWED_ROLES);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [profileId, setProfileId] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);

  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: listAccounts });
  const personsQuery = useQuery({ queryKey: ['persons'], queryFn: listPersons });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    // has_account on a person flips when their account is created or deleted.
    queryClient.invalidateQueries({ queryKey: ['persons'] });
  }

  // gcTime 0: a finished mutation holds the generated password in its data, so
  // it must leave the cache as soon as the credential popup is dismissed.
  const createMutation = useMutation({
    gcTime: 0,
    mutationFn: (input: CreateAccountInput) => createAccount(input),
    onSuccess: (created) => {
      refresh();
      setCreating(false);
      setCreateError(null);
      setCredential({ title: 'Account created', username: created.username, password: created.password });
    },
    onError: (err: unknown) => setCreateError(extractErrorMessage(err)),
  });

  const resetMutation = useMutation({
    gcTime: 0,
    mutationFn: ({ id, password }: { id: number; username: string; password?: string }) =>
      resetAccountPassword(id, password),
    onSuccess: (result, variables) => {
      setResetTarget(null);
      setResetError(null);
      setCredential({
        title: 'Password reset',
        username: variables.username,
        password: result.password,
        note: SESSIONS_NOTE,
      });
    },
    onError: (err: unknown) => setResetError(extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAccount(id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => setDeleteError(extractErrorMessage(err)),
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  const accounts = accountsQuery.data ?? [];
  const persons = personsQuery.data ?? [];
  const personName = (personId: number | null) => persons.find((p) => p.id === personId)?.name ?? null;
  const needle = searchText.trim().toLowerCase();
  const shown = accounts.filter((a) => a.username.toLowerCase().includes(needle));
  const profile = accounts.find((a) => a.id === profileId) ?? null;

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">Accounts</h1>
        <input
          aria-label="Search accounts"
          placeholder="Search by username..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-64 rounded border border-border px-3 py-2 text-sm"
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreating(true);
          }}
          className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white"
        >
          + Create Account
        </button>
      </TopbarSlot>

      {personsQuery.isError && (
        <p role="alert" className="mb-3 text-sm text-danger">
          Couldn&apos;t load people, so linked person names are unavailable: {extractErrorMessage(personsQuery.error)}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card">
        {accountsQuery.isLoading ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : accountsQuery.isError ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            {extractErrorMessage(accountsQuery.error)}
          </p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">No accounts match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Linked person</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((account) => (
                <tr
                  key={account.id}
                  onClick={() => setProfileId(account.id)}
                  className="cursor-pointer border-b border-border hover:bg-accent-light"
                >
                  <td className="px-4 py-3">
                    <button type="button" className="font-semibold text-text">
                      {account.username}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={account.role} />
                  </td>
                  <td className="px-4 py-3 text-text-muted">{personName(account.person_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(account.created_at).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {profile && (
        <AccountProfileModal
          account={profile}
          personName={personName(profile.person_id)}
          canManage={canManageAccountOfRole(user.role, profile.role)}
          isLastAdmin={isLastAdmin(accounts, profile)}
          onReset={() => {
            setResetError(null);
            setResetTarget(profile);
            setProfileId(null);
          }}
          onDelete={() => {
            setDeleteError(null);
            setDeleting(profile);
            setProfileId(null);
          }}
          onClose={() => setProfileId(null)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          username={resetTarget.username}
          onReset={(password) =>
            resetMutation.mutate({ id: resetTarget.id, username: resetTarget.username, password })
          }
          onClose={() => {
            setResetTarget(null);
            setResetError(null);
            // A failed attempt keeps its variables, including the typed password.
            resetMutation.reset();
          }}
          error={resetError}
          isSaving={resetMutation.isPending}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this account?"
          body={`"${deleting.username}" will no longer be able to sign in. This cannot be undone.`}
          confirmLabel="Delete Account"
          error={deleteError}
          isConfirming={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}

      {creating && (
        <AccountFormModal
          callerRole={user.role}
          persons={persons}
          personsUnavailable={personsQuery.isError}
          onSave={(input) => createMutation.mutate(input)}
          onClose={() => {
            setCreating(false);
            setCreateError(null);
            createMutation.reset();
          }}
          error={createError}
          isSaving={createMutation.isPending}
        />
      )}

      {credential && (
        <CredentialResultModal
          title={credential.title}
          username={credential.username}
          password={credential.password}
          note={credential.note}
          onClose={() => {
            setCredential(null);
            // The mutation cache would otherwise keep the generated password in memory.
            createMutation.reset();
            resetMutation.reset();
          }}
        />
      )}
    </>
  );
}
