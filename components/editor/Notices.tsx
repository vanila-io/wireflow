'use client';
// Short messages over the canvas (what a load or an action changed, or why it failed).
export type Notice = { id: number; text: string; tone: 'info' | 'error' };

let nextId = 0;
export const notice = (text: string, tone: Notice['tone'] = 'info'): Notice => ({ id: ++nextId, text, tone });

export default function Notices({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.id}
          role={n.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-3 rounded-lg px-3 py-2 text-xs shadow-lg ring-1 ${n.tone === 'error' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-white text-ink ring-wire-border'}`}
        >
          <p className="flex-1 leading-5">{n.text}</p>
          <button onClick={() => onDismiss(n.id)} aria-label="Dismiss" className="shrink-0 rounded px-1 text-base leading-5 text-ink-soft hover:text-ink">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
