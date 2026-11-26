'use client';

import React, { useState } from 'react';
import { Check, Lightbulb, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from './ui';
import { useToast } from './ToastProvider';

export type IdeaCategory =
  | 'FLOW_MOVIE'
  | 'FLOW_BULK'
  | 'NOTEBOOK_GPU'
  | 'BRAND_MASCOT'
  | 'AD_SPY'
  | 'UNIVERSAL_PLAYBOOK'
  | 'EBOOK'
  | 'SPREADSHEET'
  | 'PLANNER'
  | 'JOURNAL'
  | 'STORE_FUNNEL'
  | 'NOTEBOOKLM_CHANNEL'
  | 'PUBLISH_TOPIC';

interface SparkedIdea {
  label: string;
  tagline: string;
  fields: Record<string, string>;
}

const DEFAULT_VIBES = [
  'Surprise Me',
  'Wealth & Cashflow',
  'Cinema & Suspense',
  'Focus & Discipline',
  'History & Culture',
];

export function IdeaSparkWidget({
  category,
  onApplyIdea,
  heading = 'Starting from a blank page? Spark curated concepts',
  vibes = DEFAULT_VIBES,
}: {
  category: IdeaCategory;
  onApplyIdea: (fields: Record<string, string>) => void;
  heading?: string;
  vibes?: string[];
}) {
  const { pushToast } = useToast();
  const [selectedVibe, setSelectedVibe] = useState(vibes[0] ?? 'Surprise Me');
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<SparkedIdea[]>([]);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const [providerLabel, setProviderLabel] = useState<string>('');

  const fetchIdeas = async (autoFillFirst: boolean) => {
    setLoading(true);
    setAppliedIdx(null);
    try {
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, moodOrNiche: selectedVibe }),
      });
      const data = (await res.json()) as { ideas?: SparkedIdea[]; provider?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not generate ideas');
      const list = data.ideas ?? [];
      setIdeas(list);
      setProviderLabel(data.provider || '');
      if (autoFillFirst && list[0]) {
        onApplyIdea(list[0].fields);
        setAppliedIdx(0);
        pushToast({
          title: `Filled "${list[0].label}"`,
          description: 'Refine any detail or click Create whenever ready.',
          tone: 'success',
        });
      }
    } catch (err) {
      pushToast({
        title: 'Concept spark failed',
        description: err instanceof Error ? err.message : 'Try again',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] p-4 space-y-3"
      data-testid="idea-spark-widget"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--bg-surface)] p-2 text-[var(--accent-text)] shrink-0">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
              Editorial Premise Desk
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">{heading}</div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Choose a direction below or fill a publication-ready concept in one click.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => fetchIdeas(false)}
            data-testid="spark-ideas-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Composing...' : 'Spark 4 Concepts'}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => fetchIdeas(true)}
            data-testid="surprise-fill-btn"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Curate &amp; Fill
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {vibes.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSelectedVibe(v)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium border transition ${
              selectedVibe === v
                ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)] font-semibold'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {ideas.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Select any concept below to populate the studio:</span>
            {providerLabel && <span className="font-mono">{providerLabel}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ideas.map((idea, idx) => {
              const selected = appliedIdx === idx;
              return (
                <button
                  key={`${idea.label}-${idx}`}
                  type="button"
                  data-testid="spark-idea-card"
                  onClick={() => {
                    onApplyIdea(idea.fields);
                    setAppliedIdx(idx);
                    pushToast({
                      title: `Loaded "${idea.label}"`,
                      description: 'Refine any detail or click Create.',
                      tone: 'success',
                    });
                  }}
                  className={`text-left rounded-xl border p-3 transition space-y-1 ${
                    selected
                      ? 'border-emerald-500/70 bg-emerald-500/10'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-accent)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{idea.label}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{idea.tagline}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
