'use client';
// A modal question (the native <dialog>: focus trap, Escape and the backdrop
// come from the browser). Cancel is focused first.
import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-xl bg-white p-5 text-ink shadow-2xl ring-1 ring-wire-border backdrop:bg-ink/30"
    >
      <h2 id="confirm-title" className="text-sm font-bold">
        {title}
      </h2>
      <div className="mt-2 text-xs leading-5 text-ink-soft">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft hover:bg-wire-canvas">
          Cancel
        </button>
        <button onClick={onConfirm} className="rounded-md bg-wire-blue px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-wire-blue-dark">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
