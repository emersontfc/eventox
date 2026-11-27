'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function EventGalleryDialog({ label, onClose, busy, children }: {
  label: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);

  return (
    <dialog ref={ref} className="event-media-dialog" aria-label={label}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={event => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}>
      <div className="event-media-dialog-inner">
        <div className="event-media-dialog-title">
          <h3>{label}</h3>
          <button type="button" className="event-media-icon" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={19} /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
