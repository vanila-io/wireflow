'use client';
// Offline editor (#110): registers /sw.js for /app and offers a new build when
// one is waiting. Until the user clicks Reload, the current build keeps working
// (offline too). Clicking reloads every tab that was offered the update, once
// the new worker has taken over. Off in `next dev` and with NEXT_PUBLIC_OFFLINE=off.
import { useEffect, useState } from 'react';

const ENABLED = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_OFFLINE !== 'off';
const HOUR = 60 * 60 * 1000;

export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!ENABLED || !('serviceWorker' in navigator)) return;
    let offered = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const offer = (worker: ServiceWorker | null) => {
      if (!worker || !navigator.serviceWorker.controller) return; // the first install needs no prompt
      offered = true;
      setWaiting(worker);
    };
    const onControllerChange = () => offered && window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker
      .register('/sw.js', { scope: '/app' })
      .then((registration) => {
        offer(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => worker.state === 'installed' && offer(worker));
        });
        // A tab kept open notices a new deploy within the hour.
        timer = setInterval(() => registration.update().catch(() => {}), HOUR);
      })
      .catch(() => {
        // No offline support (private mode, an old browser): the editor works online as before.
      });
    return () => {
      clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div role="status" className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-white px-3 py-2 text-xs text-ink shadow-lg ring-1 ring-wire-border">
      <span>A new version of Wireflow is available.</span>
      <button
        onClick={() => {
          // Leave any field being edited first, so its value is saved.
          (document.activeElement as HTMLElement | null)?.blur();
          waiting.postMessage('SKIP_WAITING');
        }}
        className="rounded-md bg-wire-blue px-3 py-1 font-bold uppercase tracking-wide text-white hover:bg-wire-blue-dark"
      >
        Reload
      </button>
    </div>
  );
}
