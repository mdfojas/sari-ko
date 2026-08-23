import { afterEach, describe, expect, test } from 'vitest';
import { supportsNativeBarcodeDetector } from '@/lib/barcode-scanner';

describe('supportsNativeBarcodeDetector', () => {
  afterEach(() => {
    // @ts-expect-error -- test-only cleanup of a global we add/remove
    delete window.BarcodeDetector;
  });

  test('returns false when the browser has no BarcodeDetector global', () => {
    expect(supportsNativeBarcodeDetector()).toBe(false);
  });

  test('returns true when the browser exposes a BarcodeDetector global', () => {
    // @ts-expect-error -- minimal stand-in for the real browser API
    window.BarcodeDetector = class {};
    expect(supportsNativeBarcodeDetector()).toBe(true);
  });
});
