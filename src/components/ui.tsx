import React from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5 border-b border-[var(--border-subtle)]">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl sm:text-[2.1rem] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
            {title}
          </h1>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-text)]">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-20px_rgba(0,0,0,0.28)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 active:scale-[0.99]';
  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const variants = {
    primary: 'bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] font-semibold shadow-sm',
    secondary:
      'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium hover:border-[var(--border-accent)] hover:text-[var(--accent-text)]',
    ghost: 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
    danger: 'bg-rose-600 text-white font-semibold hover:bg-rose-500 shadow-sm',
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 transition focus:border-[var(--border-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 transition focus:border-[var(--border-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25',
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm text-[var(--text-primary)] transition focus:border-[var(--border-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-1.5',
        className
      )}
    >
      {children}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const style =
    s === 'HEALTHY' || s === 'COMPLETED' || s === 'OK'
      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : s === 'COOLDOWN' || s === 'PAUSED_QUOTA' || s === 'RUNNING'
      ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30'
      : s === 'EXHAUSTED_TODAY' || s === 'INVALID' || s === 'FAILED'
      ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/30'
      : 'border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase',
        style
      )}
    >
      {status}
    </span>
  );
}
