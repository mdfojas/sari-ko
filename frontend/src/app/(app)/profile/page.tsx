'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RoleBadge } from '@/components/role-badge';
import { TopbarSlot } from '@/components/topbar-slot';
import { useAuth } from '@/contexts/auth-context';
import { useRequireRole } from '@/hooks/use-auth-guards';
import { extractErrorMessage } from '@/lib/error-message';
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password-rules';
import { changePassword, changeUsername } from '@/lib/profile-client';
import { ROUTE_ACCESS } from '@/lib/route-access';

const ALLOWED_ROLES = ROUTE_ACCESS['/profile'];
// Mirrors the backend's limit (shared/validation.ts).
const MAX_USERNAME_LENGTH = 50;

const inputClass = 'w-full rounded border border-border px-3 py-2 text-sm text-text';
const labelClass = 'mb-1 block text-xs font-semibold text-text-muted';

export default function ProfilePage() {
  useRequireRole(ALLOWED_ROLES);
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const usernameMutation = useMutation({
    mutationFn: (value: string) => changeUsername(value),
    onSuccess: async (_data, value) => {
      setUsername(value);
      setUsernameSaved(true);
      await refreshUser();
    },
    onError: (err: unknown) => setUsernameError(extractErrorMessage(err)),
  });

  // gcTime 0: the mutation's variables hold both passwords, so they must leave
  // the cache as soon as nothing is observing it; reset() clears them on success.
  const passwordMutation = useMutation({
    gcTime: 0,
    mutationFn: ({ current, next }: { current: string; next: string }) => changePassword(current, next),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSaved(true);
      passwordMutation.reset();
    },
    // A wrong current password is a 401 from the backend, not an expired session:
    // the API client doesn't sign anyone out on it, so we only show the message.
    onError: (err: unknown) => setPasswordError(extractErrorMessage(err)),
  });

  if (!user) return null;

  function handleSaveUsername() {
    if (usernameMutation.isPending) return;
    setUsernameSaved(false);
    const trimmed = username.trim();
    if (trimmed === '') {
      setUsernameError('Username is required.');
      return;
    }
    if (trimmed.length > MAX_USERNAME_LENGTH) {
      setUsernameError(`Username can be at most ${MAX_USERNAME_LENGTH} characters.`);
      return;
    }
    setUsernameError(null);
    usernameMutation.mutate(trimmed);
  }

  function handleSavePassword() {
    if (passwordMutation.isPending) return;
    setPasswordSaved(false);
    if (currentPassword === '' || newPassword === '') {
      setPasswordError('Enter your current password and a new one.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setPasswordError(PASSWORD_RULE_MESSAGE);
      return;
    }
    setPasswordError(null);
    passwordMutation.mutate({ current: currentPassword, next: newPassword });
  }

  const usernameUnchanged = username.trim() === user.username;

  return (
    <>
      <TopbarSlot>
        <h1 className="text-lg font-bold text-text">My Profile</h1>
      </TopbarSlot>

      <div className="max-w-md rounded-lg border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-bold uppercase text-white">
            {user.username[0]}
          </div>
          <div>
            <h2 className="text-base font-bold text-text">{user.username}</h2>
            <RoleBadge role={user.role} />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="mp-username" className={labelClass}>
            Username
          </label>
          <input
            id="mp-username"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>
        {usernameError && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {usernameError}
          </p>
        )}
        {usernameSaved && (
          <p role="status" className="mb-3 text-sm text-accent-dark">
            Username updated.
          </p>
        )}
        <button
          type="button"
          onClick={handleSaveUsername}
          disabled={usernameUnchanged || usernameMutation.isPending}
          className="mb-5 rounded-md border border-border px-3 py-2 text-sm font-semibold text-text disabled:opacity-50"
        >
          {usernameMutation.isPending ? 'Saving…' : 'Save username'}
        </button>

        <hr className="mb-5 border-border" />

        <div className="mb-3">
          <label htmlFor="mp-current-password" className={labelClass}>
            Current password
          </label>
          <input
            id="mp-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="mp-new-password" className={labelClass}>
            New password (8–16 characters)
          </label>
          <input
            id="mp-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {passwordError && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {passwordError}
          </p>
        )}
        {passwordSaved && (
          <p role="status" className="mb-3 text-sm text-accent-dark">
            Password updated.
          </p>
        )}
        <button
          type="button"
          onClick={handleSavePassword}
          disabled={passwordMutation.isPending}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {passwordMutation.isPending ? 'Saving…' : 'Save password'}
        </button>
      </div>
    </>
  );
}
