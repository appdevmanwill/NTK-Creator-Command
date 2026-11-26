'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, DollarSign, FolderDown, HelpCircle, ShieldCheck, Sliders, X } from 'lucide-react';
import { Button } from './ui';
import { useExperienceMode } from './ExperienceModeProvider';

const HELP_ITEMS = [
  {
    icon: Compass,
    title: 'Where should I start?',
    body: 'Follow the 4 simple steps on the Home screen: (1) Pick a niche idea, (2) Create one digital product like an ebook or budget sheet, (3) Make a video or brand pack, and (4) Launch safely with a draft upload pack.',
  },
  {
    icon: DollarSign,
    title: 'Will anything charge my card?',
    body: 'No. Everything runs locally on your computer using free-tier AI keys or copy-paste Zero-Key prompts. Recommended storefronts like Payhip, Selar, and Gumroad have $0 monthly fees.',
  },
  {
    icon: ShieldCheck,
    title: 'Will this post to my YouTube channel by mistake?',
    body: 'Never. Safe Draft Mode fills in your title, description, and thumbnail, then STOPS on the review screen so nothing goes public without your own final click.',
  },
  {
    icon: FolderDown,
    title: 'Where are my downloaded files saved?',
    body: 'Every PDF, Excel sheet, and .ZIP pack you build stays saved in "4. Launch & My Files -> My Downloads" (/library), so you can preview or re-download them anytime.',
  },
];

export function QuickHelpDrawer() {
  const { helpOpen, setHelpOpen, mode, setMode } = useExperienceMode();

  if (!helpOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="quick-help-drawer">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setHelpOpen(false)}
      />
      <aside className="relative z-10 w-full max-w-md bg-[var(--bg-surface)] border-l h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">60-Second Beginner Guide</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Plain-English answers — no tech jargon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            aria-label="Close help drawer"
            data-testid="close-help-drawer"
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {HELP_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border bg-[var(--bg-elevated)] p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
              </div>
            );
          })}

          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <Sliders className="h-4 w-4 text-indigo-400" />
              <span>Workspace Complexity Mode</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {mode === 'guided'
                ? 'You are in Guided Mode (5 calm steps, advanced dials tucked away).'
                : 'You are in Pro Mode (all 16 studios, advanced options, and Admin API Key Vault visible).'}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMode(mode === 'guided' ? 'pro' : 'guided')}
              className="w-full"
            >
              Switch to {mode === 'guided' ? 'Pro Mode (All 16 Tools)' : 'Guided Mode (Beginner Friendly)'}
            </Button>
          </div>
        </div>

        <div className="border-t p-4 flex items-center justify-between gap-2">
          <Link href="/" onClick={() => setHelpOpen(false)} className="flex-1">
            <Button className="w-full" size="sm">Back to 4-Step Start Screen</Button>
          </Link>
        </div>
      </aside>
    </div>
  );
}
