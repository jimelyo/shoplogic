/**
 * Camera-based code scanning built on the native `BarcodeDetector` API.
 *
 * The API is only available in Chromium-based browsers, so every entry point is
 * guarded: where it is missing the camera button simply does not render and the
 * app keeps working with a USB scanner (which types into the search field) or
 * manual entry. No polyfill is loaded on purpose.
 */

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = (new (opts?: { formats?: string[] }) => BarcodeDetectorLike)
  & { getSupportedFormats?: () => Promise<string[]> };

const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

/** Formats worth reading in a phone shop: retail barcodes, IMEIs and 2D codes. */
const WANTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

export function scannerSupported(): boolean {
  return typeof Detector !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

async function formats(): Promise<string[] | undefined> {
  if (!Detector?.getSupportedFormats) return undefined;
  try {
    const supported = await Detector.getSupportedFormats();
    const list = WANTED_FORMATS.filter((f) => supported.includes(f));
    return list.length ? list : undefined;
  } catch {
    return undefined;
  }
}

export interface ScanSession { stop: () => void }

/**
 * Starts reading codes from `video` and reports every detection through `onCode`.
 * Returns `null` when the browser cannot scan or the camera is unavailable —
 * callers must treat that as "keep the manual flow", never as an error state.
 */
export async function startScan(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  intervalMs = 250,
): Promise<ScanSession | null> {
  if (!Detector || !video) return null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    return null;
  }

  video.srcObject = stream;
  video.muted = true;
  try { await video.play(); } catch { /* the browser may still be starting the track */ }

  const detector = new Detector({ formats: await formats() });
  let busy = false;
  const id = window.setInterval(async () => {
    if (busy || video.readyState < 2) return;
    busy = true;
    try {
      const [first] = await detector.detect(video);
      if (first?.rawValue) onCode(first.rawValue);
    } catch {
      // A frame the decoder cannot read is normal; keep polling.
    } finally {
      busy = false;
    }
  }, intervalMs);

  return {
    stop: () => {
      window.clearInterval(id);
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
  };
}
