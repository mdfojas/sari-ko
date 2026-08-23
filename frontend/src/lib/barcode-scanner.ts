export interface BarcodeScanner {
  start(
    container: HTMLElement,
    onDetect: (code: string) => void,
    onError: (err: Error) => void
  ): Promise<void>;
  stop(): Promise<void>;
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];

export function supportsNativeBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

// Thin wrappers around browser/third-party camera + decoding APIs — not
// meaningfully unit-testable without a real camera, consistent with the
// project's convention of only unit-testing zero-I/O logic. The
// BarcodeScannerButton component that consumes this is tested by injecting
// a fake BarcodeScanner instead.

function createNativeScanner(): BarcodeScanner {
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let rafId: number | null = null;

  return {
    async start(container, onDetect, onError) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Could not access the camera'));
        return;
      }

      video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      container.appendChild(video);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DetectorCtor = (window as any).BarcodeDetector;
      const detector = new DetectorCtor({ formats: BARCODE_FORMATS });

      const tick = async () => {
        if (!video) return;
        try {
          const results = await detector.detect(video);
          if (results.length > 0) {
            onDetect(results[0].rawValue);
            return;
          }
        } catch {
          // A single failed detection pass is not fatal — keep scanning.
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    },

    async stop() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
      video?.remove();
      stream = null;
      video = null;
    },
  };
}

function createHtml5QrcodeScanner(): BarcodeScanner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let instance: any = null;

  return {
    async start(container, onDetect, onError) {
      if (!container.id) {
        container.id = `barcode-scanner-${Math.random().toString(36).slice(2)}`;
      }
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        instance = new Html5Qrcode(container.id);
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (code: string) => onDetect(code),
          () => {
            // Per-frame "nothing found yet" — expected, not an error.
          }
        );
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Could not start the barcode scanner'));
      }
    },

    async stop() {
      if (instance) {
        await instance.stop().catch(() => {});
        instance = null;
      }
    },
  };
}

export function createBarcodeScanner(): BarcodeScanner {
  return supportsNativeBarcodeDetector() ? createNativeScanner() : createHtml5QrcodeScanner();
}
