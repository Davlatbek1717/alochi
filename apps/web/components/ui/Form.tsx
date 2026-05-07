'use client';
import {
  forwardRef,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';

/**
 * A'lochi form primitives — token-driven, accessible, distinct from
 * generic Tailwind defaults. Matches the Login/Register editorial form
 * style so admin pages can adopt it without one-off styling.
 *
 * Common props:
 * - `label`     uppercase eyebrow above the field
 * - `hint`      small note below
 * - `error`     red message + danger ring
 * - `leadingIcon` / `trailingIcon` for icon-led inputs
 */

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-extrabold text-[var(--ink-3)] uppercase tracking-[0.16em] mb-2"
      >
        {label}
        {required && (
          <span className="text-[var(--danger)] normal-case tracking-normal ml-1">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-2 text-xs text-[var(--ink-3)]">{hint}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-[var(--danger)] font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_BASE = [
  'w-full px-4 py-3 rounded-xl',
  'border-[1.5px] font-medium text-[var(--ink)]',
  'bg-[var(--surface-2)]',
  'placeholder:text-[var(--ink-4)] placeholder:font-normal',
  'outline-none transition-all duration-150',
  'focus:bg-[var(--surface)] focus:ring-4',
  'disabled:opacity-60 disabled:cursor-not-allowed',
].join(' ');

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', invalid, leadingIcon, trailingIcon, ...rest },
  ref,
) {
  const focusRing = invalid
    ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/12'
    : 'border-[var(--line-strong)] focus:border-[var(--brand)] focus:ring-[var(--brand)]/12';

  if (leadingIcon || trailingIcon) {
    return (
      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-4)] pointer-events-none">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          className={[
            INPUT_BASE,
            focusRing,
            leadingIcon ? 'pl-10' : '',
            trailingIcon ? 'pr-10' : '',
            className,
          ].join(' ')}
          {...rest}
        />
        {trailingIcon && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-4)]">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      className={[INPUT_BASE, focusRing, className].join(' ')}
      {...rest}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className = '', invalid, ...rest }, ref) {
    const focusRing = invalid
      ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/12'
      : 'border-[var(--line-strong)] focus:border-[var(--brand)] focus:ring-[var(--brand)]/12';
    return (
      <textarea
        ref={ref}
        className={[
          INPUT_BASE,
          focusRing,
          'min-h-[110px] resize-y leading-relaxed',
          className,
        ].join(' ')}
        {...rest}
      />
    );
  },
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className = '', invalid, children, ...rest }, ref) {
    const focusRing = invalid
      ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/12'
      : 'border-[var(--line-strong)] focus:border-[var(--brand)] focus:ring-[var(--brand)]/12';
    return (
      <div className="relative">
        <select
          ref={ref}
          className={[
            INPUT_BASE,
            focusRing,
            'pr-10 appearance-none',
            'bg-[image:var(--select-arrow)] bg-no-repeat bg-[right_0.875rem_center]',
            className,
          ].join(' ')}
          style={{
            // Inline so it doesn't depend on tailwind config —
            // chevron in ink-3 colour.
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          }}
          {...rest}
        >
          {children}
        </select>
      </div>
    );
  },
);
