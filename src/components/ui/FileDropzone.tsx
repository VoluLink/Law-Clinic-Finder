'use client';

import { useRef } from 'react';

type FileDropzoneProps = {
  label: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  onFile: (file: File) => void;
};

/** Click-or-choose upload zone (the design's dashed logo drop area). */
export function FileDropzone({ label, hint, accept, disabled, onFile }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-primary/30 bg-surface-tint p-6 text-center hover:border-primary disabled:opacity-50"
    >
      <span aria-hidden className="text-2xl text-primary">
        ↥
      </span>
      <span className="text-sm font-semibold text-primary">{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </button>
  );
}
