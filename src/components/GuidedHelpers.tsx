'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, ChevronUp, ShieldCheck, Sparkles } from 'lucide-react';
import { useExperienceMode } from './ExperienceModeProvider';
import { Button, Card } from './ui';

export interface SamplePreset {
  label: string;
  onApply: () => void;
}

export function StudioStarterBanner({
  whatYouGet,
  safeNote,
  samples = [],
}: {
  whatYouGet: string;
  safeNote?: string;
  samples?: SamplePreset[];
}) {
  return (
    <Card className="border-[var(--border-accent)] bg-[var(--accent-soft)] space-y-3 py-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-text)]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Edition Deliverables</span>
          </div>
          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{whatYouGet}</p>
        </div>
        {safeNote && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{safeNote}</span>
          </div>
        )}
      </div>

      {samples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Curated Editions:</span>
          {samples.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onApply}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] hover:text-[var(--accent-text)] transition"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AdvancedOptionsToggle({
  title = 'Customize More Options (Optional)',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const { mode } = useExperienceMode();
  const [open, setOpen] = useState(mode === 'pro');

  useEffect(() => {
    setOpen(mode === 'pro');
  }, [mode]);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/70">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] space-y-3">{children}</div>}
    </div>
  );
}

export function NextStepCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="border-[var(--border-accent)] bg-[var(--accent-soft)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
          Next Stage
        </div>
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
      <Link href={href} className="shrink-0">
        <Button size="sm">
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </Card>
  );
}
