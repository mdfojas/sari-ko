'use client';

import { useEffect, useRef, useState } from 'react';
import { createBarcodeScanner, type BarcodeScanner } from '@/lib/barcode-scanner';

interface BarcodeScannerButtonProps {
  onScan: (code: string) => void;
  scannerFactory?: () => BarcodeScanner;
}

export function BarcodeScannerButton({
  onScan,
  scannerFactory = createBarcodeScanner,
}: BarcodeScannerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<BarcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const scanner = scannerFactory();
    scannerRef.current = scanner;
    setError(null);

    scanner.start(
      containerRef.current,
      (code) => {
        onScan(code);
        setIsOpen(false);
      },
      (err) => setError(err.message)
    );

    return () => {
      scanner.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-text hover:border-accent hover:bg-accent-light hover:text-accent-dark"
      >
        📷 Scan barcode
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Scan barcode"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-96 rounded-lg bg-card p-5">
            <h2 className="mb-3 text-base font-bold text-text">Scan barcode</h2>
            {error && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {error}
              </p>
            )}
            <div ref={containerRef} data-testid="barcode-scanner-viewport" className="mb-4 min-h-48" />
            <button type="button" onClick={close} className="rounded-md border border-border px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
