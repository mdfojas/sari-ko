export const TOKEN_KEY = 'sariko.token';

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

// localStorage is shared by every tab, but the token a tab *uses* must not be:
// if it were re-read on every request, a tab showing one user would silently
// start sending whichever token the last-signed-in tab wrote, and fill the page
// with that other person's data. So each tab binds to the token it
// authenticated with (undefined = not read yet) and only changes it on its own
// sign-in or sign-out, or when it deliberately adopts a change via
// syncTokenFromStorage() (on the `storage` event).
let boundToken: string | null | undefined;

function readStorage(): string | null {
  return hasLocalStorage() ? localStorage.getItem(TOKEN_KEY) : null;
}

export function getToken(): string | null {
  if (boundToken === undefined) boundToken = readStorage();
  return boundToken;
}

export function setToken(token: string): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(TOKEN_KEY, token);
  boundToken = token;
}

// Signs this tab out. The storage key is shared, so it is only removed if it
// still holds this tab's own token: another tab may have signed in as someone
// else since, and that person must not be signed out by this tab's logout.
export function clearToken(): void {
  if (!hasLocalStorage()) return;
  if (localStorage.getItem(TOKEN_KEY) === getToken()) localStorage.removeItem(TOKEN_KEY);
  boundToken = null;
}

// Adopts whatever is stored right now (another tab signed in, or out).
export function syncTokenFromStorage(): string | null {
  boundToken = readStorage();
  return boundToken;
}
