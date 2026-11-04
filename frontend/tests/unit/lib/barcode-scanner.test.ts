import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createBarcodeScanner, supportsNativeBarcodeDetector } from '@/lib/barcode-scanner';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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

describe('createBarcodeScanner — native BarcodeDetector path', () => {
  let originalMediaDevices: MediaDevices;

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).BarcodeDetector = class {
      detect() {
        return Promise.resolve([]);
      }
    };
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: originalMediaDevices, configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).BarcodeDetector;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('releases the camera if stop() is called before getUserMedia resolves', async () => {
    const stopTrack = vi.fn();
    const fakeStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    const gum = deferred<MediaStream>();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockReturnValue(gum.promise) },
      configurable: true,
    });

    const scanner = createBarcodeScanner();
    const container = document.createElement('div');

    const startPromise = scanner.start(container, vi.fn(), vi.fn());
    await scanner.stop(); // user cancels before getUserMedia has resolved

    gum.resolve(fakeStream);
    await startPromise;

    expect(stopTrack).toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();
  });

  test('does not report a code that was still being detected when the user cancelled', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    const detection = deferred<{ rawValue: string }[]>();
    const detect = vi.fn().mockReturnValue(detection.promise);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).BarcodeDetector = class {
      detect = detect;
    };
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });

    const scanner = createBarcodeScanner();
    const onDetect = vi.fn();
    await scanner.start(document.createElement('div'), onDetect, vi.fn());
    await vi.waitFor(() => expect(detect).toHaveBeenCalled()); // a detection is now in flight

    await scanner.stop(); // the user cancels...
    detection.resolve([{ rawValue: '4800016600011' }]); // ...and then that detection finds a code
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onDetect).not.toHaveBeenCalled();
  });

  test('surfaces a BarcodeDetector construction failure via onError and releases the camera', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).BarcodeDetector = class {
      constructor() {
        throw new Error('Unsupported format');
      }
    };
    const stopTrack = vi.fn();
    const fakeStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });

    const scanner = createBarcodeScanner();
    const container = document.createElement('div');
    const onError = vi.fn();

    await scanner.start(container, vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(stopTrack).toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();
  });
});

const html5QrcodeStart = vi.fn();
const html5QrcodeStop = vi.fn().mockResolvedValue(undefined);

vi.mock('html5-qrcode', () => ({
  // Must be constructible via `new` — an arrow-function implementation
  // isn't, and silently makes `new Html5Qrcode(...)` throw.
  Html5Qrcode: vi.fn().mockImplementation(function () {
    return { start: html5QrcodeStart, stop: html5QrcodeStop };
  }),
}));

describe('createBarcodeScanner — html5-qrcode fallback path', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).BarcodeDetector;
    html5QrcodeStart.mockReset();
    html5QrcodeStop.mockClear();
  });

  test('stops the just-started instance if stop() is called before instance.start() resolves', async () => {
    const started = deferred<void>();
    html5QrcodeStart.mockReturnValue(started.promise);

    const scanner = createBarcodeScanner();
    const container = document.createElement('div');

    const startPromise = scanner.start(container, vi.fn(), vi.fn());
    // The dynamic import('html5-qrcode') resolves after an unpredictable
    // number of microtask ticks, so wait for the deterministic signal —
    // instance.start() actually being called — before racing stop() against it.
    await vi.waitFor(() => expect(html5QrcodeStart).toHaveBeenCalled());
    await scanner.stop(); // user cancels before instance.start() resolves

    started.resolve();
    await startPromise;

    expect(html5QrcodeStop).toHaveBeenCalled();
  });
});
