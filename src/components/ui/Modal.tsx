'use client';

import { useEffect, type ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  );
}
