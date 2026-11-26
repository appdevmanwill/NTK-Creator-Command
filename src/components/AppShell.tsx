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
  Music,
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
    heading: 'ATELIER',
    items: [
      { label: 'Atelier Overview', href: '/', icon: LayoutDashboard },
      { label: 'Editorial Hook Coach', href: '/coach', icon: Flame },
      { label: 'NotebookLM Channel Bible', href: '/notebooklm', icon: BookOpen },
    ],
  },
  {
    heading: 'PRODUCTION PACKS',
    items: [
      { label: 'Flow Cinema Studio', href: '/packs/flow-movie', icon: Film },
      { label: 'Music & Video Studio', href: '/packs/music-studio', icon: Music },
      { label: 'Visual Style Cloner', href: '/packs/flow-bulk', icon: Layers },
      { label: 'Cloud GPU Lab', href: '/packs/notebooks', icon: Cpu },
      { label: 'Brand Identity & Ad Intelligence', href: '/packs/brand-and-spy', icon: Sparkles },
      { label: 'Universal Playbook Engine', href: '/packs/universal', icon: Globe },
    ],
  },
  {
    heading: 'DIGITAL PRESS',
    items: [
      { label: 'Digital Press Studio', href: '/products', icon: Package },
      { label: 'Storefront & Launch Copy', href: '/products/funnel', icon: Compass },
      { label: 'Market & Store Audit', href: '/products/analyzer', icon: Search },
    ],
  },
  {
    heading: 'INTELLIGENCE & RELEASE',
    items: [
      { label: 'Opportunity Atlas', href: '/research/faceless-finder', icon: Radar },
      { label: 'Demand Radar', href: '/research/trends', icon: TrendingUp },
      { label: 'Safe Release Desk', href: '/publish-packs', icon: UploadCloud },
    ],
  },
  {
    heading: 'VAULT & SYSTEM',
    items: [
      { label: 'Editions Archive', href: '/library', icon: FolderArchive },
      { label: 'API Key Vault & Router', href: '/admin/keys', icon: KeyRound },
    ],
  },
];

const GUIDED_NAV_ITEMS = [
  {
    label: 'Atelier Home',
    href: '/',
    icon: LayoutDashboard,
    match: (p: string) => p === '/',
  },
  {
    label: '01 · Opportunity Atlas',
    href: '/research/faceless-finder',
    icon: Radar,
    match: (p: string) => p.startsWith('/research') || p.startsWith('/coach') || p.startsWith('/notebooklm'),
  },
  {
    label: '02 · Digital Press',
    href: '/products',
    icon: Package,
    match: (p: string) => p.startsWith('/products'),
  },
  {
    label: '03 · Cinema & Visuals',
    href: '/packs/flow-movie',
    icon: Film,
    match: (p: string) => p.startsWith('/packs'),
  },
  {
    label: '04 · Release & Archive',
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
      { label: 'Channel Index', href: '/research/faceless-finder' },
      { label: 'Demand Radar', href: '/research/trends' },
      { label: 'Editorial Hook Coach', href: '/coach' },
      { label: 'Channel Bible', href: '/notebooklm' },
    ],
  },
  {
    match: (p) => p.startsWith('/products'),
    tabs: [
      { label: 'Digital Press Studio', href: '/products' },
      { label: 'Storefront Copy Desk', href: '/products/funnel' },
      { label: 'Competitor Audit', href: '/products/analyzer' },
    ],
  },
  {
    match: (p) => p.startsWith('/packs'),
    tabs: [
      { label: 'Flow Cinema Studio', href: '/packs/flow-movie' },
      { label: 'Music & Video Studio', href: '/packs/music-studio' },
      { label: 'Visual Style Cloner', href: '/packs/flow-bulk' },
      { label: 'Cloud GPU Lab', href: '/packs/notebooks' },
      { label: 'Brand & Ad Intelligence', href: '/packs/brand-and-spy' },
      { label: 'Custom Playbooks', href: '/packs/universal' },
    ],
  },
  {
    match: (p) => p.startsWith('/publish-packs') || p.startsWith('/library'),
    tabs: [
      { label: 'Safe Release Desk', href: '/publish-packs' },
      { label: 'My Editions Vault', href: '/library' },
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
      <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)]">
        <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-label="NTK Monogram Crest">
            <rect width="36" height="36" rx="9" fill="#111115" />
            <rect x="2.25" y="2.25" width="31.5" height="31.5" rx="7" stroke="#D4AF37" strokeOpacity="0.45" strokeWidth="1" />
            <path
              d="M8.5 23.5V12.5L14.5 23.5V12.5M17.2 12.5H22.2M19.7 12.5V23.5M24.4 12.5V23.5M24.4 18L28.5 12.5M24.4 18L28.5 23.5"
              stroke="url(#ntkChampagne)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="ntkChampagne" x1="8" y1="10" x2="29" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F5ECD6" />
                <stop offset="0.5" stopColor="#D4AF37" />
                <stop offset="1" stopColor="#B88B22" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <div className="font-display text-[17px] font-semibold tracking-tight text-[var(--text-primary)] leading-none">
              NTK Creator Command
            </div>
            <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">
              {expMode === 'guided' ? 'Private Creator Atelier' : 'Executive Studio'}
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
            <div className="px-2.5 mb-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-[var(--text-secondary)]/85">
              CREATOR EDITION PATH
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
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all',
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-sm'
                      : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
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
                className="w-full flex items-center gap-2.5 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-2.5 text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--accent)]/20 transition"
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>Atelier Quick Guide</span>
              </button>
            </div>
          </div>
        ) : (
          PRO_NAV_SECTIONS.map((sec) => (
            <div key={sec.heading}>
              <div className="px-2.5 mb-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-[var(--text-secondary)]/85">
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
                        'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs transition-all',
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-sm'
                          : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
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

      <div className="border-t border-[var(--border-subtle)] p-3 space-y-2">
        <div
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 flex items-center gap-1"
          data-testid="experience-mode-toggle"
        >
          <button
            type="button"
            onClick={() => setExpMode('guided')}
            data-testid="mode-guided-btn"
            className={cn(
              'flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition',
              expMode === 'guided'
                ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm'
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
                ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            Pro (All 16)
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1.5 flex items-center justify-between gap-1">
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
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-sm'
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
      <aside className="hidden lg:block w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] h-full">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/92 backdrop-blur px-3 sm:px-6 min-h-14 py-2 flex items-center justify-between gap-2 safe-top">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg border p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-xs font-semibold tracking-tight text-[var(--text-primary)] sm:hidden truncate">
              NTK Creator
            </div>
            <div className="text-xs font-medium tracking-wide text-[var(--text-secondary)] hidden sm:block truncate">
              {expMode === 'guided'
                ? 'Guided Atelier · Every release waits for your final approval'
                : 'Executive Studio · Local-First Architecture'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              data-testid="open-help-btn"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition min-h-[36px]"
            >
              <HelpCircle className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              <span className="hidden xs:inline sm:inline">Guide</span>
            </button>

            <Link
              href="/admin/keys"
              data-testid="pool-health-pill"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 sm:px-3 py-1.5 text-xs font-medium hover:border-[var(--border-accent)] transition min-h-[36px]"
            >
              <Activity
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  health && health.healthy > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : health && health.cooldown > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-[var(--text-secondary)]'
                )}
              />
              {health ? (
                expMode === 'guided' ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      {health.healthy > 0 ? `AI (${health.healthy})` : 'Zero-Key'}
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{health.healthy} healthy</span>
                    {health.cooldown > 0 && <span className="hidden sm:inline text-amber-600 dark:text-amber-400">· {health.cooldown} cooldown</span>}
                    {health.exhausted > 0 && <span className="hidden sm:inline text-rose-600 dark:text-rose-400">· {health.exhausted} exhausted</span>}
                    {health.totalEnabled === 0 && <span className="text-[var(--text-secondary)]">· Zero-Key</span>}
                    {health.pausedJobs > 0 && (
                      <span className="hidden sm:inline rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        {health.pausedJobs} saved drafts
                      </span>
                    )}
                  </span>
                )
              ) : (
                <span>AI...</span>
              )}
            </Link>
          </div>
        </header>

        {activePillar && (
          <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 px-4 sm:px-6 lg:px-8 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap gap-1.5">
              {activePillar.tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs transition',
                      isActive
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold shadow-sm'
                        : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-5 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Native Bottom Navigation Bar */}
        <nav
          aria-label="Mobile navigation"
          data-testid="mobile-bottom-nav"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur safe-bottom"
        >
          <div className="grid grid-cols-5 h-16">
            {[
              { label: 'Home', href: '/', icon: LayoutDashboard, active: pathname === '/' },
              {
                label: 'Atlas',
                href: '/research/faceless-finder',
                icon: Radar,
                active: pathname.startsWith('/research') || pathname.startsWith('/coach'),
              },
              {
                label: 'Press',
                href: '/products',
                icon: Package,
                active: pathname.startsWith('/products'),
              },
              {
                label: 'Cinema',
                href: '/packs/flow-movie',
                icon: Film,
                active: pathname.startsWith('/packs'),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    item.active ? 'text-[var(--accent-text)] font-semibold' : 'text-[var(--text-secondary)]'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="More studios and settings"
            >
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
