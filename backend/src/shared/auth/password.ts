import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const SALT_ROUNDS = 10;
const RANDOM_PASSWORD_LENGTH = 12;
const RANDOM_PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt silently truncates at 72 bytes — two different passwords sharing a
// 72-byte prefix would hash identically. Capping well under that (16 chars)
// makes the truncation case unreachable, not just unlikely.
export const MAX_PASSWORD_LENGTH = 16;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

export function passwordStrengthMessage(fieldName = 'password'): string {
  return `${fieldName} must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`;
}

export function generateRandomPassword(): string {
  let password = '';
  for (let i = 0; i < RANDOM_PASSWORD_LENGTH; i++) {
    password += RANDOM_PASSWORD_ALPHABET[randomInt(RANDOM_PASSWORD_ALPHABET.length)];
  }
  return password;
}
