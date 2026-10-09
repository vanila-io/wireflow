// The floating toolbar's icon buttons, as on production.
const p = { stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS: Record<string, React.ReactNode> = {
  'Zoom out': <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  'Zoom in': <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  'Fit view': <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...p} />,
  Undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" {...p} />,
  Redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" {...p} />,
  'Export JSON': <path d="M12 3v12M7 10l5 5 5-5M4 19h16" {...p} />,
  'Clear canvas': <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" {...p} />,
};

export default function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-wire-canvas hover:text-wire-blue">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        {ICONS[label]}
      </svg>
    </button>
  );
}
