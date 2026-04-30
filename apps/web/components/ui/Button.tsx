'use client';
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white border-transparent',
  danger: 'bg-red-600 hover:bg-red-500 text-white border-red-600',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
});
