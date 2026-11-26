'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpen,
  Compass,
  Cpu,
  Film,
  Flame,
  FolderArchive,
  Globe,
  HelpCircle,
  KeyRound,
  Layers,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  Package,
  Radar,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
  UploadCloud,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, ThemeMode } from './ThemeProvider';
import { useExperienceMode } from './ExperienceModeProvider';

interface NavSection {
  heading: string;
  items: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string }> }>;
}

const PRO_NAV_SECTIONS: NavSection[] = [
  {
    heading: 'COMMAND CENTER',
    items: [
      { label: 'Dashboard Home', href: '/', icon: LayoutDashboard },
      { label: 'AI Coach & Viral Hooks', href: '/coach', icon: Flame },
      { label: 'NotebookLM Blueprint', href: '/notebooklm', icon: BookOpen },
    ],
  },
  {
    heading: 'AGENT PACKS',
    items: [
      { label: 'Google Flow Movies & Series', href: '/packs/flow-movie', icon: Film },
      { label: 'Flow Bulk Style Cloner', href: '/packs/flow-bulk', icon: Layers },
      { label: 'Kaggle & Colab GPU Notebooks', href: '/packs/notebooks', icon: Cpu },
      { label: 'Brand/Mascot & Ad Spy Packs', href: '/packs/brand-and-spy', icon: Sparkles },
      { label: 'Universal Any-Platform Pack', href: '/packs/universal', icon: Globe },
    ],
  },
  {
    heading: 'DIGITAL PRODUCTS',
    items: [
      { label: 'Product Studio', href: '/products', icon: Package },
      { label: 'Store Copy & Promo Funnel', href: '/products/funnel', icon: Compass },
      { label: 'Product & Store Analyzer', href: '/products/analyzer', icon: Search },
    ],
  },
  {
    heading: 'RESEARCH & PUBLISH',
    items: [
      { label: 'Faceless Finder', href: '/research/faceless-finder', icon: Radar },
      { label: 'Trend Finder', href: '/research/trends', icon: TrendingUp },
      { label: 'Publishing & OAuth Packs', href: '/publish-packs', icon: UploadCloud },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { label: 'Pack & Product Library', href: '/library', icon: FolderArchive },
      { label: 'Admin API Key Vault', href: '/admin/keys', icon: KeyRound },
    ],
  },
];

const GUIDED_NAV_ITEMS = [
  {
    label: 'Start Here',
    href: '/',
    icon: LayoutDashboard,
    match: (p: string) => p === '/',
  },
  {
    label: '1. Find Ideas & Hooks',
    href: '/research/faceless-finder',
    icon: Radar,
    match: (p: string) => p.startsWith('/research') || p.startsWith('/coach') || p.startsWith('/notebooklm'),
  },
  {
    label: '2. Create a Product',
    href: '/products',
    icon: Package,
    match: (p: string) => p.startsWith('/products'),
  },
  {
    label: '3. Make Videos & Visuals',
    href: '/packs/flow-movie',
    icon: Film,
    match: (p: string) => p.startsWith('/packs'),
  },
  {
    label: '4. Launch & My Files',
    href: '/publish-packs',
    icon: UploadCloud,
    match: (p: string) => p.startsWith('/publish-packs') || p.startsWith('/library'),
  },
];

const PILLAR_TABS: Array<{
  match: (p: string) => boolean;
  tabs: Array<{ label: string; href: string }>;
}> = [
  {
    match: (p) => p.startsWith('/research') || p.startsWith('/coach') || p.startsWith('/notebooklm'),
    tabs: [
      { label: 'Winning Channels', href: '/research/faceless-finder' },
      { label: 'Trend Checker', href: '/research/trends' },
      { label: 'Hook & Name Coach', href: '/coach' },
      { label: 'Channel Plan', href: '/notebooklm' },
    ],
  },
  {
    match: (p) => p.startsWith('/products'),
    tabs: [
      { label: 'Create Ebook / Sheet / Planner', href: '/products' },
      { label: 'Write Store Page', href: '/products/funnel' },
      { label: 'Check Competitor', href: '/products/analyzer' },
    ],
  },
  {
    match: (p) => p.startsWith('/packs'),
    tabs: [
      { label: 'AI Story Movie', href: '/packs/flow-movie' },
      { label: 'Style Video', href: '/packs/flow-bulk' },
      { label: 'Free Cloud GPU', href: '/packs/notebooks' },
      { label: 'Logo & Brand Kit', href: '/packs/brand-and-spy' },
      { label: 'Any Website Guide', href: '/packs/universal' },
    ],
  },
  {
    match: (p) => p.startsWith('/publish-packs') || p.startsWith('/library'),
    tabs: [
      { label: 'Safe Draft Publisher', href: '/publish-packs' },
      { label: 'My Downloads', href: '/library' },
    ],
  },
];

interface PoolHealth {
  totalEnabled: number;
  healthy: number;
  cooldown: number;
  exhausted: number;
  invalid: number;
  pausedJobs: number;
  activeFailover: boolean;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { mode: expMode, setMode: setExpMode, setHelpOpen } = useExperienceMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<PoolHealth | null>(null);

  useEffect(() => {
    let active = true;
    const loadHealth = async () => {
      try {
        const res = await fetch('/api/admin/keys/health', { cache: 'no-store' });
        if (res.ok && active) {
          setHealth((await res.json()) as PoolHealth);
        }
      } catch {
        // ignore transient fetch errors
      }
    };
    loadHealth();
    const timer = setInterval(loadHealth, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pathname]);

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  const activePillar = expMode === 'guided' ? PILLAR_TABS.find((p) => p.match(pathname)) : undefined;

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
          <svg width="34" height="34" viewBox="0 0 36 36" fill="none" aria-label="NTK Logo">
            <rect width="36" height="36" rx="10" fill="url(#ntkGrad)" />
            <path d="M9 24V12L15 24V12M18 12H23M20.5 12V24M25 12V24M25 18L29.5 12M25 18L29.5 24" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="ntkGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4F46E5" />
                <stop offset="1" stopColor="#0EA5E9" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div className="text-sm font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              NTK Creator Command
            </div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-indigo-400">
              {expMode === 'guided' ? 'Guided Studio' : 'Pro Command'}
            </div>
          </div>
        </Link>
        <button
          type="button"
          className="lg:hidden p-1.5 rounded-lg text-[var(--text-secondary)]"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" data-testid="sidebar-nav">
        {expMode === 'guided' ? (
          <div className="space-y-1.5">
            <div className="px-2.5 mb-2 text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]/80">
              4-STEP CREATOR PATH
            </div>
            {GUIDED_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  setHelpOpen(true);
                }}
                className="w-full flex items-center gap-2.5 rounded-xl border bg-[var(--bg-elevated)] px-3 py-2.5 text-xs font-semibold text-indigo-400 hover:border-indigo-500/50 transition"
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>Need Help? 60-Sec Guide</span>
              </button>
            </div>
          </div>
        ) : (
          PRO_NAV_SECTIONS.map((sec) => (
            <div key={sec.heading}>
              <div className="px-2.5 mb-1.5 text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)]/80">
                {sec.heading}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || (item.href !== '/products' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors',
                        active
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      <div className="border-t p-3 space-y-2">
        <div className="rounded-xl border bg-[var(--bg-elevated)] p-1 flex items-center gap-1" data-testid="experience-mode-toggle">
          <button
            type="button"
            onClick={() => setExpMode('guided')}
            data-testid="mode-guided-btn"
            className={cn(
              'flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition',
              expMode === 'guided'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            Guided Mode
          </button>
          <button
            type="button"
            onClick={() => setExpMode('pro')}
            data-testid="mode-pro-btn"
            className={cn(
              'flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition',
              expMode === 'pro'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            Pro (All 16)
          </button>
        </div>

        <div className="rounded-xl border bg-[var(--bg-elevated)] p-1.5 flex items-center justify-between gap-1">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = themeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setThemeMode(opt.value)}
                title={`Theme: ${opt.label}`}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition',
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r bg-[var(--bg-surface)] sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[var(--bg-surface)] border-r h-full">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b bg-[var(--bg-surface)]/90 backdrop-blur px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg border p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-xs font-medium text-[var(--text-secondary)] hidden sm:block">
              {expMode === 'guided'
                ? 'Beginner-Friendly Mode • Nothing posts without your final click'
                : 'Pro Command Center • $0 Local Studio'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              data-testid="open-help-btn"
              className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50 transition"
            >
              <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
              <span>Help</span>
            </button>

            <Link
              href="/admin/keys"
              data-testid="pool-health-pill"
              className="inline-flex items-center gap-2 rounded-full border bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium hover:border-indigo-500/50 transition"
            >
              <Activity
                className={cn(
                  'h-3.5 w-3.5',
                  health && health.healthy > 0
                    ? 'text-emerald-400'
                    : health && health.cooldown > 0
                    ? 'text-amber-400'
                    : 'text-slate-400'
                )}
              />
              {health ? (
                expMode === 'guided' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-semibold">
                      {health.healthy > 0 ? `AI Ready (${health.healthy} healthy)` : 'Zero-Key Mode'}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-semibold">{health.healthy} healthy</span>
                    {health.cooldown > 0 && <span className="text-amber-400">• {health.cooldown} cooldown</span>}
                    {health.exhausted > 0 && <span className="text-rose-400">• {health.exhausted} exhausted</span>}
                    {health.totalEnabled === 0 && <span className="text-slate-400">• Zero-Key Mode</span>}
                    {health.pausedJobs > 0 && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                        {health.pausedJobs} saved drafts
                      </span>
                    )}
                  </span>
                )
              ) : (
                <span>Checking AI...</span>
              )}
            </Link>
          </div>
        </header>

        {activePillar && (
          <div className="border-b bg-[var(--bg-surface)]/70 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap gap-1.5">
              {activePillar.tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
