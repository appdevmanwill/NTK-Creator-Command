'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  Download,
  Film,
  Flame,
  FolderArchive,
  KeyRound,
  Package,
  Radar,
  UploadCloud,
} from 'lucide-react';
import { Button, Card, PageHeader, StatusBadge } from '@/components/ui';

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

const QUICK_LAUNCH = [
  { title: 'Google Flow Movie Pack', desc: 'Character & location profiles + shots + FFmpeg', href: '/packs/flow-movie', icon: Film },
  { title: 'Digital Product Studio', desc: 'Local PDF ebooks, formula .xlsx & 365-day planners', href: '/products', icon: Package },
  { title: 'Kaggle & Colab Notebooks', desc: 'Free T4/P100 GPU music, shorts & Whisper packs', href: '/packs/notebooks', icon: Cpu },
  { title: 'Faceless Channel Finder', desc: '30+ seeded channels + digital product link scan', href: '/research/faceless-finder', icon: Radar },
  { title: 'Viral Hook Coach', desc: 'Hooks, high-CPM niches & handle availability', href: '/coach', icon: Flame },
  { title: 'Publishing & OAuth Packs', desc: 'BrowserOS neo draft pack & YouTube Python uploader', href: '/publish-packs', icon: UploadCloud },
];

export default function DashboardHomePage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        subtitle="Local-first AI agent pack builder, digital product studio, and YouTube research workspace engineered for $0 incremental cloud spend."
        badge="v1.0 Local-First"
        actions={
          <Link href="/admin/keys">
            <Button variant="secondary" size="sm">
              <KeyRound className="h-3.5 w-3.5" /> Manage Key Vault
            </Button>
          </Link>
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
          <div className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Paused Checkpoints</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{data?.stats.pausedJobsCount ?? 0}</span>
            <span className="text-xs text-[var(--text-secondary)]">recoverable jobs</span>
          </div>
        </Card>
      </div>

      {data?.pausedJobs?.length ? (
        <Card className="border-amber-500/40 bg-amber-500/5 space-y-3">
          <h2 className="text-sm font-bold text-amber-400">Paused Jobs Ready to Resume</h2>
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
          {QUICK_LAUNCH.map((item) => {
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
