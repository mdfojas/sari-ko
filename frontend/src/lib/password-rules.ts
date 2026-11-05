// Mirrors the backend's rule (shared/auth/password.ts): 8-16 characters, no
// composition requirements. The 16-character ceiling exists to keep every
// password under bcrypt's 72-byte silent-truncation threshold.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 16;

export const PASSWORD_RULE_MESSAGE = `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`;

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
