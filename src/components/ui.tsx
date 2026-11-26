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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-5 border-b">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/25">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)] max-w-3xl">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
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
    <div className={cn('rounded-2xl border bg-[var(--bg-surface)] p-5 shadow-sm', className)}>
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
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/50';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/20',
    secondary: 'border bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:border-indigo-500/50',
    ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
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
        'w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
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
        'w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
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
        'w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
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
    <label className={cn('block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5', className)}>
      {children}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const style =
    s === 'HEALTHY' || s === 'COMPLETED' || s === 'OK'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : s === 'COOLDOWN' || s === 'PAUSED_QUOTA' || s === 'RUNNING'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : s === 'EXHAUSTED_TODAY' || s === 'INVALID' || s === 'FAILED'
      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      : 'bg-slate-500/15 text-slate-400 border-slate-500/30';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', style)}>
      {status}
    </span>
  );
}
