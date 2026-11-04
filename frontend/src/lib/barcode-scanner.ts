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

// Thin wrappers around browser/third-party camera + decoding APIs. Actual
// detection/permission-prompt behavior isn't meaningfully unit-testable
// without a real camera — the BarcodeScannerButton component that consumes
// this is tested by injecting a fake BarcodeScanner instead. The start/stop
// cancellation ordering below (see tests/unit/lib/barcode-scanner.test.ts)
// is plain async control flow over mocked Web APIs, so it is covered.

function createNativeScanner(): BarcodeScanner {
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let rafId: number | null = null;
  // Set by stop(). start() checks this after every await so a stop() that
  // lands while getUserMedia (or anything after it) is still in flight
  // releases the camera as soon as that work resolves, instead of leaving
  // an unreferenced stream/video running with nothing left able to stop it.
  let stopped = false;

  return {
    async start(container, onDetect, onError) {
      stopped = false;
      let acquiredStream: MediaStream;
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Could not access the camera'));
        return;
      }

      if (stopped) {
        acquiredStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = acquiredStream;

      try {
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
          if (!video || stopped) return;
          try {
            const results = await detector.detect(video);
            // stop() may have landed while that detection was in flight; a
            // cancelled scan must not still fill in the caller's search box.
            if (stopped) return;
            if (results.length > 0) {
              onDetect(results[0].rawValue);
              return;
            }
          } catch {
            // A single failed detection pass is not fatal — keep scanning.
          }
          if (!stopped) rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        stream?.getTracks().forEach((track) => track.stop());
        video?.remove();
        stream = null;
        video = null;
        onError(err instanceof Error ? err : new Error('Could not start the barcode scanner'));
      }
    },

    async stop() {
      stopped = true;
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
  // Same race as the native scanner: a stop() landing while the dynamic
  // import or instance.start() is still in flight must release the camera
  // once that work resolves, instead of leaving `instance` running.
  let stopped = false;

  return {
    async start(container, onDetect, onError) {
      stopped = false;
      if (!container.id) {
        container.id = `barcode-scanner-${Math.random().toString(36).slice(2)}`;
      }
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (stopped) return;

        const started = new Html5Qrcode(container.id);
        await started.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (code: string) => onDetect(code),
          () => {
            // Per-frame "nothing found yet" — expected, not an error.
          }
        );

        if (stopped) {
          await started.stop().catch(() => {});
          return;
        }
        instance = started;
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Could not start the barcode scanner'));
      }
    },

    async stop() {
      stopped = true;
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
