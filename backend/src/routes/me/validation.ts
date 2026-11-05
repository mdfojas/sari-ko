import { passwordStrengthMessage, validatePasswordStrength } from '../../shared/auth/password.js';
import { isPlainObject, validateUsername } from '../../shared/validation.js';

export interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

export function validateChangePassword(body: ChangePasswordBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (!body.currentPassword || !body.newPassword) {
    return 'currentPassword and newPassword are required';
  }
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return 'currentPassword and newPassword must be text';
  }
  if (!validatePasswordStrength(body.newPassword)) {
    return passwordStrengthMessage('newPassword');
  }
  return null;
}

export interface ChangeUsernameBody {
  username?: string;
}

export function validateChangeUsername(body: ChangeUsernameBody): string | null {
  if (!isPlainObject(body)) return 'Request body must be a JSON object';
  if (body.username === undefined || body.username === null) return 'username is required';
  return validateUsername(body.username);
}
