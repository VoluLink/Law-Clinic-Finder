type ColorFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
};

/** A swatch + hex row for the branding palette editor. */
export function ColorField({ label, hint, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-12 cursor-pointer rounded-md border border-border bg-surface"
      />
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label} Hex`}
        className="w-24 rounded-md border border-border bg-surface-tint px-2 py-1 font-mono text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
