import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanLine } from 'lucide-react';
import { scannerSupported, startScan, type ScanSession } from '../lib/scanner';
import { Button } from './shared/Forms';
import { Modal } from './shared/Modal';

/** Camera button; renders nothing where the browser cannot scan. */
export function ScanButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation();
  if (!scannerSupported()) return null;
  return (
    <button type="button" onClick={onClick} title={t('scan.open')} aria-label={t('scan.open')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sl-border bg-sl-card text-sl-muted shadow-sm hover:border-primary/60 hover:text-primary ${className}`}>
      <ScanLine className="size-5" />
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Receives each decoded value; the caller decides whether to close. */
  onCode: (code: string) => void;
}

/**
 * Live camera viewfinder. Mounted only while open, so its state starts fresh on
 * every scan; where `BarcodeDetector` is missing it explains why instead of
 * failing silently.
 */
export function BarcodeScanner({ open, onClose, onCode }: Props) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} size="sm" title={`📷 ${t('scan.title')}`} subtitle={t('scan.hint')}
      footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      {open && <ScannerView onCode={onCode} />}
    </Modal>
  );
}

function ScannerView({ onCode }: { onCode: (code: string) => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeRef = useRef(onCode);
  const [status, setStatus] = useState<'starting' | 'live' | 'unsupported' | 'denied'>(() =>
    (scannerSupported() ? 'starting' : 'unsupported'));
  const [last, setLast] = useState('');

  useEffect(() => { codeRef.current = onCode; }, [onCode]);

  useEffect(() => {
    if (!scannerSupported()) return;
    let session: ScanSession | null = null;
    let disposed = false;
    (async () => {
      const video = videoRef.current;
      if (!video) return;
      session = await startScan(video, (code) => {
        setLast(code);
        codeRef.current(code);
      });
      if (disposed) { session?.stop(); return; }
      setStatus(session ? 'live' : 'denied');
    })();
    return () => {
      disposed = true;
      session?.stop();
    };
  }, []);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-sl-border bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="aspect-video w-full object-cover" />
      </div>

      {status === 'starting' && <p className="mt-3 text-sm text-sl-muted">⏳ {t('scan.starting')}</p>}
      {status === 'live' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-sl-muted">
          <span className="size-2 animate-pulse rounded-full bg-green-500" /> {t('scan.scanning')}
          {last && <code className="rounded bg-sl-hover px-1.5 py-0.5 text-xs text-sl-text">{last}</code>}
        </p>
      )}
      {status === 'denied' && <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">🎥 {t('scan.denied')}</p>}
      {status === 'unsupported' && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">⚠️ {t('scan.unsupported')}</p>
      )}
    </div>
  );
}
