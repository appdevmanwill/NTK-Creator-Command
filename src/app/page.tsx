'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  Download,
  Film,
  Flame,
  FolderArchive,
  HelpCircle,
  KeyRound,
  Music,
  Package,
  Radar,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Button, Card, PageHeader, StatusBadge } from '@/components/ui';
import { useExperienceMode } from '@/components/ExperienceModeProvider';

interface DashboardData {
  stats: {
    projectsCount: number;
    channelsCount: number;
    keysCount: number;
    healthyKeysCount: number;
    pausedJobsCount: number;
  };
  pausedJobs: Array<{ id: string; title: string; moduleType: string; completedSteps: number; totalSteps: number }>;
  recentProjects: Array<{ id: string; title: string; type: string; createdAt: string }>;
}

const PRO_QUICK_LAUNCH = [
  { title: 'Flow Cinema Studio', desc: 'Character & set continuity profiles, shot prompts & stream-copy FFmpeg', href: '/packs/flow-movie', icon: Film },
  { title: 'Music & Video Studio', desc: 'Google Flow Music, Suno, Treblo, ACE Studio MIDI, Colab/Kaggle Audio + MP4', href: '/packs/music-studio', icon: Music },
  { title: 'Digital Press Studio', desc: 'Print-editorial PDF editions, formula .xlsx models & 365-day planners', href: '/products', icon: Package },
  { title: 'Cloud GPU Production Lab', desc: 'Free Colab & Kaggle T4/P100 notebooks for music, shorts & Whisper', href: '/packs/notebooks', icon: Cpu },
  { title: 'Opportunity Atlas', desc: 'Tracked faceless channels with live digital store & revenue signals', href: '/research/faceless-finder', icon: Radar },
  { title: 'Editorial Hook Coach', desc: 'Strategy threads, opening hooks & live YouTube handle checks', href: '/coach', icon: Flame },
  { title: 'Safe Release Desk', desc: 'BrowserOS neo human-in-the-loop drafts & Python YouTube OAuth packs', href: '/publish-packs', icon: UploadCloud },
];

export default function DashboardHomePage() {
  const { mode, setMode, setHelpOpen } = useExperienceMode();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (mode === 'guided') {
    const hasProjects = (data?.stats.projectsCount ?? 0) > 0;
    const journeySteps = [
      {
        numeral: '01',
        title: 'Study Proven Opportunities',
        desc: 'Inspect 30 active faceless channels, review niche revenue estimates, and uncover which digital products viewers already buy.',
        href: '/research/faceless-finder',
        cta: 'Open Opportunity Atlas',
        icon: Radar,
        done: (data?.stats.channelsCount ?? 0) > 0,
      },
      {
        numeral: '02',
        title: 'Press a Flagship Digital Edition',
        desc: 'Author an editorial PDF book, an auto-calculating Excel financial tracker, or a 30-day planner ready for your storefront.',
        href: '/products',
        cta: 'Enter Digital Press',
        icon: Package,
        done: hasProjects,
      },
      {
        numeral: '03',
        title: 'Direct Your Cinema & Brand Pack',
        desc: 'Shape a one-line story into locked cast profiles, ordered shots, and a cohesive visual identity kit.',
        href: '/packs/flow-movie',
        cta: 'Open Cinema Studio',
        icon: Film,
        done: hasProjects,
      },
      {
        numeral: '04',
        title: 'Prepare Storefront & Safe Release',
        desc: 'Draft storefront copy for zero-fee platforms and stage an upload package that waits for your final approval.',
        href: '/publish-packs',
        cta: 'Open Safe Release Desk',
        icon: UploadCloud,
        done: false,
      },
    ];

    return (
      <div className="space-y-7" data-testid="guided-home">
        <Card className="atelier-hero-bg border-[var(--border-accent)] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
                <Sparkles className="h-3 w-3" /> Private Creator Atelier · Guided Edition
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold tracking-tight text-[var(--text-primary)] leading-[1.08]">
                Build something worth owning.
              </h1>
              <p className="text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                Choose a clear starting point below and move through the studio at your own pace. You write zero code, pay zero monthly software fees, and control every final release.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setHelpOpen(true)} className="shrink-0">
              <HelpCircle className="h-4 w-4 text-[var(--accent-text)]" /> Atelier Guide
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5" data-testid="starter-picker">
            <Link href="/research/faceless-finder" className="group">
              <div className="h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-accent)] transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
                      01 / Discover
                    </span>
                    <Compass className="h-4 w-4 text-[var(--accent-text)]" />
                  </div>
                  <div>
                    <div className="font-display text-xl font-semibold text-[var(--text-primary)] leading-snug">
                      Spot Proven Niches &amp; Offers
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                      Examine real faceless channels, monthly revenue estimates, and linked digital products.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[var(--accent-text)] inline-flex items-center">
                  Open Opportunity Atlas <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            <Link href="/products" className="group">
              <div className="h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-accent)] transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
                      02 / Publish
                    </span>
                    <Package className="h-4 w-4 text-[var(--accent-text)]" />
                  </div>
                  <div>
                    <div className="font-display text-xl font-semibold text-[var(--text-primary)] leading-snug">
                      Press a Flagship Digital Edition
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                      Compile a print-grade PDF book, formula Excel workbook, or hyperlinked planner locally.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[var(--accent-text)] inline-flex items-center">
                  Enter Digital Press <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            <Link href="/packs/flow-movie" className="group">
              <div className="h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-accent)] transition-all flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
                      03 / Direct
                    </span>
                    <Film className="h-4 w-4 text-[var(--accent-text)]" />
                  </div>
                  <div>
                    <div className="font-display text-xl font-semibold text-[var(--text-primary)] leading-snug">
                      Direct a Cinematic Video Pack
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                      Expand a single premise into consistent cast profiles, ordered shots, and assembly cues.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[var(--accent-text)] inline-flex items-center">
                  Open Cinema Studio <ArrowRight className="h-3.5 w-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          </div>
        </Card>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Four-Stage Studio Architecture
            </h2>
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">
              Guided Edition
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="four-step-journey">
            {journeySteps.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.numeral} className="flex flex-col justify-between gap-4 hover:border-[var(--border-accent)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className="font-display text-3xl font-semibold leading-none text-[var(--accent-text)] select-none pt-0.5">
                        {item.numeral}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">{item.title}</h3>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                    {item.done && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" />}
                  </div>
                  <div className="flex justify-end pt-1">
                    <Link href={item.href}>
                      <Button size="sm" variant="secondary">
                        {item.cta} <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              AI Pool Ready: {data ? `${data.stats.healthyKeysCount}/${data.stats.keysCount} healthy` : '—'}
            </span>
            <span>{data?.stats.channelsCount ?? 30} benchmarked channels</span>
            <span>{data?.stats.projectsCount ?? 0} saved editions</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/library">
              <Button size="sm" variant="ghost">
                <FolderArchive className="h-3.5 w-3.5" /> My Editions Vault
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setMode('pro')}>
              Switch to Executive Pro
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pro-home">
      <PageHeader
        title="Executive Atelier"
        subtitle="Local-first production studio for cinema agent packs, digital editions, and channel intelligence."
        badge="Pro Mode"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode('guided')}>
              Switch to Guided Atelier
            </Button>
            <Link href="/admin/keys">
              <Button variant="secondary" size="sm">
                <KeyRound className="h-3.5 w-3.5" /> Manage Key Vault
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            API Vault Health
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-display text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
              {data ? `${data.stats.healthyKeysCount}/${data.stats.keysCount}` : '—'}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">healthy keys</span>
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Saved Editions
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-display text-3xl font-semibold text-[var(--accent-text)]">
              {data?.stats.projectsCount ?? '—'}
            </span>
            <Link href="/library" className="text-xs font-medium text-[var(--accent-text)] hover:underline">
              Open Vault
            </Link>
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Indexed Channels
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-display text-3xl font-semibold text-[var(--text-primary)]">
              {data?.stats.channelsCount ?? '—'}
            </span>
            <Link href="/research/faceless-finder" className="text-xs font-medium text-[var(--accent-text)] hover:underline">
              Explore
            </Link>
          </div>
        </Card>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Checkpointed Jobs
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="font-display text-3xl font-semibold text-amber-600 dark:text-amber-400">
              {data?.stats.pausedJobsCount ?? 0}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">resumable drafts</span>
          </div>
        </Card>
      </div>

      {data?.pausedJobs?.length ? (
        <Card className="border-amber-500/40 bg-amber-500/5 space-y-3">
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Checkpointed Drafts Ready to Resume</h2>
          <div className="space-y-2">
            {data.pausedJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between text-xs border rounded-xl p-2.5 bg-[var(--bg-surface)]">
                <div>
                  <span className="font-semibold">{j.title}</span>{' '}
                  <span className="text-[var(--text-secondary)]">({j.moduleType})</span>
                </div>
                <span className="font-mono text-amber-700 dark:text-amber-400">
                  {j.completedSteps}/{j.totalSteps} steps saved
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
          Studio Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRO_QUICK_LAUNCH.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group">
                <Card className="h-full transition-all group-hover:border-[var(--border-accent)] flex flex-col justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] p-2.5 text-[var(--accent-text)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-xs font-semibold text-[var(--accent-text)]">
                    Enter Studio <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4 text-[var(--accent-text)]" />
            <h2 className="text-sm font-semibold">Recent Editions &amp; Packs</h2>
          </div>
          <Link href="/library" className="text-xs font-medium text-[var(--accent-text)] hover:underline">
            View Archive
          </Link>
        </div>
        {!data?.recentProjects?.length ? (
          <p className="text-xs text-[var(--text-secondary)]">
            No editions compiled yet. Open any studio above to author your first deliverable.
          </p>
        ) : (
          <div className="space-y-2">
            {data.recentProjects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusBadge status={p.type} />
                  <span className="font-semibold truncate">{p.title}</span>
                </div>
                <a
                  href={`/api/projects/${p.id}/download`}
                  download
                  className="text-[var(--accent-text)] font-medium hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
