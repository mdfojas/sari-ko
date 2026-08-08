import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const SALT_ROUNDS = 10;
const RANDOM_PASSWORD_LENGTH = 12;
const RANDOM_PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(password: string): boolean {
  return password.length >= 8;
}

export function generateRandomPassword(): string {
  let password = '';
  for (let i = 0; i < RANDOM_PASSWORD_LENGTH; i++) {
    password += RANDOM_PASSWORD_ALPHABET[randomInt(RANDOM_PASSWORD_ALPHABET.length)];
  }
  return password;
}
