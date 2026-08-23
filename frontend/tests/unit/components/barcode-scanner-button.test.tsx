import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BarcodeScannerButton } from '@/components/barcode-scanner-button';
import type { BarcodeScanner } from '@/lib/barcode-scanner';

function makeFakeScanner(): { scanner: BarcodeScanner; stop: ReturnType<typeof vi.fn> } {
  let detectCallback: ((code: string) => void) | null = null;
  let errorCallback: ((err: Error) => void) | null = null;
  const stop = vi.fn().mockResolvedValue(undefined);

  const scanner: BarcodeScanner = {
    start: vi.fn(async (_container, onDetect, onError) => {
      detectCallback = onDetect;
      errorCallback = onError;
    }),
    stop,
  };

  return {
    scanner,
    stop,
    // expose a way for tests to simulate a detection/error from "the camera"
    ...{
      simulateDetect: (code: string) => detectCallback?.(code),
      simulateError: (err: Error) => errorCallback?.(err),
    },
  } as unknown as { scanner: BarcodeScanner; stop: ReturnType<typeof vi.fn> };
}

describe('BarcodeScannerButton', () => {
  test('opens the scanner view and starts scanning when clicked', () => {
    const fake = makeFakeScanner();
    const onScan = vi.fn();
    render(<BarcodeScannerButton onScan={onScan} scannerFactory={() => fake.scanner} />);

    fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }));

    expect(screen.getByRole('dialog', { name: /scan barcode/i })).toBeInTheDocument();
    expect(fake.scanner.start).toHaveBeenCalled();
  });

  test('calls onScan and closes the dialog when the scanner detects a code', () => {
    const fake = makeFakeScanner();
    const onScan = vi.fn();
    render(<BarcodeScannerButton onScan={onScan} scannerFactory={() => fake.scanner} />);
    fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }));

    act(() => {
      (fake as unknown as { simulateDetect: (code: string) => void }).simulateDetect('4800016600011');
    });

    expect(onScan).toHaveBeenCalledWith('4800016600011');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('shows an error message if the scanner reports a failure (e.g. camera permission denied)', () => {
    const fake = makeFakeScanner();
    render(<BarcodeScannerButton onScan={vi.fn()} scannerFactory={() => fake.scanner} />);
    fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }));

    act(() => {
      (fake as unknown as { simulateError: (err: Error) => void }).simulateError(
        new Error('Camera permission denied')
      );
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Camera permission denied');
  });

  test('stops the scanner when the dialog is cancelled', () => {
    const fake = makeFakeScanner();
    render(<BarcodeScannerButton onScan={vi.fn()} scannerFactory={() => fake.scanner} />);
    fireEvent.click(screen.getByRole('button', { name: /scan barcode/i }));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(fake.stop).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
