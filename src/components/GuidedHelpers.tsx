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
    <Card className="border-indigo-500/25 bg-indigo-500/5 space-y-3 py-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>What you&apos;ll get</span>
          </div>
          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{whatYouGet}</p>
        </div>
        {safeNote && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{safeNote}</span>
          </div>
        )}
      </div>

      {samples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Try a sample example:</span>
          {samples.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onApply}
              className="rounded-full border bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-indigo-500/60 transition"
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
    <div className="rounded-xl border bg-[var(--bg-elevated)]/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 border-t space-y-3">{children}</div>}
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
    <Card className="border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="space-y-0.5">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Recommended Next Step</div>
        <div className="text-sm font-bold text-[var(--text-primary)]">{title}</div>
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
