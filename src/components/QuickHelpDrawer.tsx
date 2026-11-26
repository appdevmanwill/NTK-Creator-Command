'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, DollarSign, FolderDown, HelpCircle, ShieldCheck, Sliders, X } from 'lucide-react';
import { Button } from './ui';
import { useExperienceMode } from './ExperienceModeProvider';

const HELP_ITEMS = [
  {
    icon: Compass,
    title: 'Where do you start?',
    body: 'Follow the 4-stage path on the Atelier Home screen: (1) study proven channels in Opportunity Atlas, (2) press an Ebook, financial spreadsheet, or planner in Digital Press, (3) build a video or brand pack in Cinema & Visuals, and (4) prepare a private draft at Release & Archive.',
  },
  {
    icon: DollarSign,
    title: 'Are there hidden fees or subscriptions?',
    body: 'No. Everything compiles locally on your computer with free-tier AI keys or copy-paste Zero-Key prompts. Recommended storefronts such as Payhip, Selar, and Gumroad operate with zero monthly fee.',
  },
  {
    icon: ShieldCheck,
    title: 'Can anything publish without approval?',
    body: 'Never. Safe Release Mode fills in your title, description, and thumbnail, then pauses on the final review screen until you click Publish yourself.',
  },
  {
    icon: FolderDown,
    title: 'Where do your finished files live?',
    body: 'Every PDF edition, formula workbook, and production ZIP stays archived under "04 · Release & Archive -> My Editions Vault" (/library) for preview or instant re-download.',
  },
];

export function QuickHelpDrawer() {
  const { helpOpen, setHelpOpen, mode, setMode } = useExperienceMode();

  if (!helpOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="quick-help-drawer">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm"
        onClick={() => setHelpOpen(false)}
      />
      <aside className="relative z-10 w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-5 w-5 text-[var(--accent-text)]" />
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] leading-tight">
                Atelier Quick Guide
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Clear orientation in under a minute</p>
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
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-1.5"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-text)]">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{item.body}</p>
              </div>
            );
          })}

          <div className="rounded-2xl border border-[var(--border-accent)] bg-[var(--accent-soft)] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
              <Sliders className="h-4 w-4 text-[var(--accent-text)]" />
              <span>Workspace Complexity</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {mode === 'guided'
                ? 'Guided Atelier is active: five calm milestones with advanced settings folded neatly away.'
                : 'Executive Pro Mode is active: all sixteen studios, advanced parameters, and the API Key Vault are open.'}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMode(mode === 'guided' ? 'pro' : 'guided')}
              className="w-full"
            >
              Switch to {mode === 'guided' ? 'Executive Pro (All 16 Studios)' : 'Guided Atelier (5 Steps)'}
            </Button>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] p-4 flex items-center justify-between gap-2">
          <Link href="/" onClick={() => setHelpOpen(false)} className="flex-1">
            <Button className="w-full" size="sm">Return to Atelier Home</Button>
          </Link>
        </div>
      </aside>
    </div>
  );
}
