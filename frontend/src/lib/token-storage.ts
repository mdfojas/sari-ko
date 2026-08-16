const TOKEN_KEY = 'sariko.token';

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function getToken(): string | null {
  return hasLocalStorage() ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string): void {
  if (hasLocalStorage()) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (hasLocalStorage()) localStorage.removeItem(TOKEN_KEY);
}
