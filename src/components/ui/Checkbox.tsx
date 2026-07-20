import { useId, type InputHTMLAttributes } from 'react';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export function Checkbox({ label, ...props }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" className="h-4 w-4 accent-primary" {...props} />
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
    </div>
  );
}
