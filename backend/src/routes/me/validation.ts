import { validatePasswordStrength } from '../../shared/auth/password.js';

export interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

export function validateChangePassword(body: ChangePasswordBody): string | null {
  if (!body.currentPassword || !body.newPassword) {
    return 'currentPassword and newPassword are required';
  }
  if (!validatePasswordStrength(body.newPassword)) {
    return 'newPassword must be at least 8 characters';
  }
  return null;
}

export interface ChangeUsernameBody {
  username?: string;
}

export function validateChangeUsername(body: ChangeUsernameBody): string | null {
  if (!body.username) {
    return 'username is required';
  }
  return null;
}
