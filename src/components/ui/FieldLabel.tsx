import { InfoHint } from './InfoHint';

type FieldLabelProps = {
  htmlFor: string;
  label: string;
  hint?: string;
  required?: boolean;
  labelHidden?: boolean;
};

/**
 * The label row shared by every clinic field control: the text, an optional
 * required marker, and an optional info-icon hint. One place, so all fields mark
 * and explain themselves the same way. When hidden, only the accessible label
 * remains (the marker/hint are surfaced elsewhere, e.g. a table header).
 */
export function FieldLabel({ htmlFor, label, hint, required, labelHidden }: FieldLabelProps) {
  if (labelHidden) {
    return (
      <label htmlFor={htmlFor} className="sr-only">
        {label}
      </label>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-sm font-medium text-foreground">
        <label htmlFor={htmlFor}>{label}</label>
        {/* Marker sits outside the <label> so it stays out of the label's text,
            and is aria-hidden — the required state is announced via aria-required
            on the control instead. */}
        {required && (
          <span className="text-danger" aria-hidden>
            {' '}
            *
          </span>
        )}
      </span>
      {hint && <InfoHint text={hint} label={label} />}
    </span>
  );
}
