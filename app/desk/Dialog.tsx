"use client";

import { useEffect, useRef } from "react";

// A native modal dialog. Escape closes it, focus returns to the opener, and the page behind is inert.
export function Dialog({ open, onClose, label, className = "", children }: { open: boolean; onClose: () => void; label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto max-h-[100dvh] max-w-[100vw] overflow-hidden bg-transparent p-0 backdrop:bg-black/70 ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}

export function CloseButton({ onClose, label = "Close" }: { onClose: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full px-3 text-sm font-medium text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300">
      {label}
    </button>
  );
}
