import { ApiError } from './api-client';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// Surfaces the backend's own `{ error }` message when there is one (e.g. a
// 409 "already exists"), and a generic fallback for everything else.
export function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: string } | null;
    if (body?.error) return body.error;
  }
  return GENERIC_MESSAGE;
}
