import { describe, expect, test } from 'vitest';
import { extractErrorMessage } from '@/lib/error-message';
import { ApiError } from '@/lib/api-client';

describe('extractErrorMessage', () => {
  test("returns the backend's own error message from an ApiError body", () => {
    expect(extractErrorMessage(new ApiError(409, { error: 'A product with this barcode already exists' }))).toBe(
      'A product with this barcode already exists'
    );
  });

  test('falls back to a generic message when an ApiError has no usable body', () => {
    expect(extractErrorMessage(new ApiError(500, null))).toBe('Something went wrong. Please try again.');
    expect(extractErrorMessage(new ApiError(500, { detail: 'x' }))).toBe('Something went wrong. Please try again.');
  });

  test('falls back to a generic message for anything that is not an ApiError', () => {
    expect(extractErrorMessage(new Error('network down'))).toBe('Something went wrong. Please try again.');
    expect(extractErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});
