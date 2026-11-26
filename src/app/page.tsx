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
  { title: 'Google Flow Movie Pack', desc: 'Character & location profiles + shots + FFmpeg', href: '/packs/flow-movie', icon: Film },
  { title: 'Digital Product Studio', desc: 'Local PDF ebooks, formula .xlsx & 365-day planners', href: '/products', icon: Package },
  { title: 'Kaggle & Colab Notebooks', desc: 'Free T4/P100 GPU music, shorts & Whisper packs', href: '/packs/notebooks', icon: Cpu },
  { title: 'Faceless Channel Finder', desc: '30+ seeded channels + digital product link scan', href: '/research/faceless-finder', icon: Radar },
  { title: 'Viral Hook Coach', desc: 'Hooks, high-CPM niches & handle availability', href: '/coach', icon: Flame },
  { title: 'Publishing & OAuth Packs', desc: 'BrowserOS neo draft pack & YouTube Python uploader', href: '/publish-packs', icon: UploadCloud },
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
        step: 'Step 1',
        title: 'Pick a Winning Idea',
        desc: 'Browse 30 real faceless channels and see what digital products they sell, or ask the AI Coach for hooks.',
        href: '/research/faceless-finder',
        cta: 'Explore 30 Channels',
        icon: Radar,
        done: (data?.stats.channelsCount ?? 0) > 0,
      },
      {
        step: 'Step 2',
        title: 'Create Your First Digital Product',
        desc: 'Make a ready-to-sell PDF Ebook, an auto-calculating Excel Sheet, or a 30-Day Planner in minutes.',
        href: '/products',
        cta: 'Create a Product',
        icon: Package,
        done: hasProjects,
      },
      {
        step: 'Step 3',
        title: 'Make Your Video & Visual Pack',
        desc: 'Turn a 1-line idea into an AI movie pack or matching channel brand kit with safe BrowserOS neo steps.',
        href: '/packs/flow-movie',
        cta: 'Make a Video Pack',
        icon: Film,
        done: hasProjects,
      },
      {
        step: 'Step 4',
        title: 'Launch Your Store & Publish Safely',
        desc: 'Write your $0-monthly storefront copy and prepare a Safe Draft upload that waits for your final click.',
        href: '/publish-packs',
        cta: 'Prepare Safe Draft',
        icon: UploadCloud,
        done: false,
      },
    ];

    return (
      <div className="space-y-6" data-testid="guided-home">
        <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-[var(--bg-surface)] to-sky-500/10 p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-0.5 text-xs font-semibold text-indigo-400">
                <Sparkles className="h-3.5 w-3.5" /> Start Here — Beginner Friendly
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                Welcome! What do you want to create today?
              </h1>
              <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
                Pick one goal below and we&apos;ll guide you step by step. No coding, no paid subscriptions, and nothing ever posts without your final click.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setHelpOpen(true)} className="shrink-0">
              <HelpCircle className="h-4 w-4 text-indigo-400" /> 60-Second Guide
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="starter-picker">
            <Link href="/research/faceless-finder" className="group">
              <div className="h-full rounded-2xl border bg-[var(--bg-surface)] p-4 hover:border-indigo-500/60 transition flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-sky-500/15 p-2.5 text-sky-400 shrink-0">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Find a profitable channel idea</div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">See real niches, earnings estimates, and product links.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-sky-400 inline-flex items-center">
                  Start with Ideas <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            <Link href="/products" className="group">
              <div className="h-full rounded-2xl border bg-[var(--bg-surface)] p-4 hover:border-indigo-500/60 transition flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-400 shrink-0">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Create my first ebook or spreadsheet</div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Export a finished PDF or Excel workbook ready to sell.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-indigo-400 inline-flex items-center">
                  Create a Product <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>

            <Link href="/packs/flow-movie" className="group">
              <div className="h-full rounded-2xl border bg-[var(--bg-surface)] p-4 hover:border-indigo-500/60 transition flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400 shrink-0">
                    <Film className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Build my first AI video pack</div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">Type a 1-line story and get ready-to-use video prompts.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-400 inline-flex items-center">
                  Build Video Pack <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Your 4-Step Creator Journey
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="four-step-journey">
            {journeySteps.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.step} className="flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-400 shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">{item.step}</div>
                        <h3 className="text-base font-bold text-[var(--text-primary)]">{item.title}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                    {item.done && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="flex justify-end">
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
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              AI Ready: {data ? `${data.stats.healthyKeysCount}/${data.stats.keysCount} healthy` : '—'}
            </span>
            <span>{data?.stats.channelsCount ?? 30} starter channels</span>
            <span>{data?.stats.projectsCount ?? 0} saved creations</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/library">
              <Button size="sm" variant="ghost">
                <FolderArchive className="h-3.5 w-3.5" /> My Downloads
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setMode('pro')}>
              Switch to Pro Command Center
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pro-home">
      <PageHeader
        title="Command Center"
        subtitle="Local-first AI agent pack builder, digital product studio, and YouTube research workspace engineered for $0 incremental cloud spend."
        badge="Pro Mode"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode('guided')}>
              Switch to Guided Mode
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
          <div className="text-xs font-semibold uppercase text-[var(--text-secondary)]">API Vault Health</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {data ? `${data.stats.healthyKeysCount}/${data.stats.keysCount}` : '—'}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">healthy keys</span>
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Saved Packs & Products</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-400">{data?.stats.projectsCount ?? '—'}</span>
            <Link href="/library" className="text-xs text-indigo-400 hover:underline">Open Library</Link>
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Tracked Faceless Channels</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-400">{data?.stats.channelsCount ?? '—'}</span>
            <Link href="/research/faceless-finder" className="text-xs text-sky-400 hover:underline">Explore</Link>
          </div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Saved Drafts</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{data?.stats.pausedJobsCount ?? 0}</span>
            <span className="text-xs text-[var(--text-secondary)]">recoverable jobs</span>
          </div>
        </Card>
      </div>

      {data?.pausedJobs?.length ? (
        <Card className="border-amber-500/40 bg-amber-500/5 space-y-3">
          <h2 className="text-sm font-bold text-amber-400">Saved Drafts Ready to Resume</h2>
          <div className="space-y-2">
            {data.pausedJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between text-xs border rounded-xl p-2.5 bg-[var(--bg-surface)]">
                <div>
                  <span className="font-semibold">{j.title}</span>{' '}
                  <span className="text-[var(--text-secondary)]">({j.moduleType})</span>
                </div>
                <span className="font-mono text-amber-400">
                  {j.completedSteps}/{j.totalSteps} steps saved
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Quick Launch Studios
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRO_QUICK_LAUNCH.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group">
                <Card className="h-full transition-all group-hover:border-indigo-500/60 group-hover:shadow-md flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-indigo-500/15 p-2.5 text-indigo-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">{item.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-xs font-semibold text-indigo-400">
                    Open Studio <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
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
            <FolderArchive className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold">Recent Packs & Products</h2>
          </div>
          <Link href="/library" className="text-xs text-indigo-400 hover:underline">
            View All
          </Link>
        </div>
        {!data?.recentProjects?.length ? (
          <p className="text-xs text-[var(--text-secondary)]">
            No packs or products compiled yet. Launch any studio above to generate your first artifact.
          </p>
        ) : (
          <div className="space-y-2">
            {data.recentProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusBadge status={p.type} />
                  <span className="font-semibold truncate">{p.title}</span>
                </div>
                <a href={`/api/projects/${p.id}/download`} download className="text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0">
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
