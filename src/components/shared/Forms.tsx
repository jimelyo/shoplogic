import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm shadow-primary/30',
  secondary: 'bg-sl-card2 text-sl-text border border-sl-border hover:bg-sl-hover',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/30',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/30',
  ghost: 'text-sl-text hover:bg-sl-hover',
  outline: 'border border-primary text-primary hover:bg-primary/10',
};
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 [&_svg]:size-3.5',
  md: 'h-10 px-4 text-sm gap-2 [&_svg]:size-4',
  lg: 'h-12 px-6 text-base gap-2 [&_svg]:size-5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading = false, icon, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

interface FieldProps { label?: string; error?: string; requiredMark?: boolean; hint?: string }

export const fieldClass = (error?: boolean) =>
  `w-full rounded-lg border bg-sl-input px-3 py-2 text-sm text-sl-text placeholder:text-sl-muted/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60 ${error ? 'border-red-500 ring-1 ring-red-500/30' : 'border-sl-border'}`;

function FieldShell({ label, error, requiredMark, hint, children }: FieldProps & { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <label className="block min-w-0">
      {label && (
        <span className="mb-1 block text-xs font-semibold text-sl-muted">
          {label}{requiredMark && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-500">{t(error)}</span> : hint ? <span className="mt-1 block text-[11px] text-sl-muted">{hint}</span> : null}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps { icon?: ReactNode }
export function Input({ label, error, requiredMark, hint, icon, className = '', ...rest }: InputProps) {
  return (
    <FieldShell label={label} error={error} requiredMark={requiredMark} hint={hint}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sl-muted [&_svg]:size-4">{icon}</span>}
        <input className={`${fieldClass(!!error)} ${icon ? 'ps-9' : ''} ${className}`} {...rest} />
      </div>
    </FieldShell>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}
export function Select({ label, error, requiredMark, hint, className = '', children, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} error={error} requiredMark={requiredMark} hint={hint}>
      <select className={`${fieldClass(!!error)} cursor-pointer ${className}`} {...rest}>{children}</select>
    </FieldShell>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}
export function TextArea({ label, error, requiredMark, hint, className = '', ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} error={error} requiredMark={requiredMark} hint={hint}>
      <textarea className={`${fieldClass(!!error)} min-h-[80px] resize-y ${className}`} {...rest} />
    </FieldShell>
  );
}

export function Toggle({ checked, onChange, label, description, disabled, size = 'md' }: {
  checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; size?: 'sm' | 'md';
}) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'size-4' : 'size-5';
  const shift = size === 'sm' ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-5 rtl:-translate-x-5';
  return (
    <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 ${track} ${checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span className={`${knob} rounded-full bg-white shadow transition-transform duration-200 ${checked ? shift : 'translate-x-0'}`} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-sl-text">{label}</span>}
          {description && <span className="block text-xs text-sl-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}