import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookText,
  CalendarDays,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Film,
  Flame,
  FolderArchive,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Link2,
  Menu,
  Monitor,
  Moon,
  Music,
  NotebookPen,
  Package,
  Plus,
  Radar,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { generateMobileAI, maskKey, testMobileKey } from './ai-router';
import {
  exportFileToDevice,
  getDeviceInfo,
  makeId,
  nativeHttpRequest,
  openExternalLink,
  syncSystemBars,
} from './bridge';
import { ChannelItem } from './channels-data';
import {
  buildCinemaOrBrandZip,
  buildEbookPdf,
  buildFormulaSpreadsheetXlsx,
  buildJournalPdf,
  buildPlannerPdf,
} from './generators';
import { buildMobileMusicVideoZip, MobileMusicPlatform } from './music-studio';
import {
  addCustomChannel,
  CoachMessage,
  deleteEdition,
  editionToUint8,
  listEditions,
  loadChannels,
  loadCoachMessages,
  loadDesktopServerUrl,
  loadMobileKeys,
  MobileApiKey,
  saveCoachMessages,
  saveDesktopServerUrl,
  SavedEdition,
  saveEdition,
  saveMobileKeys,
} from './storage';

type TabId = 'home' | 'atlas' | 'press' | 'cinema' | 'vault' | 'coach' | 'keys' | 'desktop';
type ThemeMode = 'system' | 'light' | 'dark';
type ExperienceMode = 'guided' | 'pro';
type PressKind = 'EBOOK' | 'SPREADSHEET' | 'PLANNER' | 'JOURNAL';
type PackKind = 'FLOW_MOVIE' | 'FLOW_BULK' | 'BRAND_PACK' | 'NOTEBOOK_PACK' | 'PUBLISH_PACK';

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  if (resolved === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  syncSystemBars(resolved);
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('ntk-theme-mode');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [expMode, setExpModeState] = useState<ExperienceMode>(() => {
    return localStorage.getItem('ntk-experience-mode') === 'pro' ? 'pro' : 'guided';
  });
  const [toast, setToast] = useState<{ title: string; tone: 'info' | 'success' | 'error' } | null>(null);

  const [channels, setChannels] = useState<ChannelItem[]>(() => loadChannels());
  const [editions, setEditions] = useState<SavedEdition[]>([]);
  const [keys, setKeys] = useState<MobileApiKey[]>(() => loadMobileKeys());
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>(() => loadCoachMessages());
  const [desktopUrl, setDesktopUrl] = useState<string>(() => loadDesktopServerUrl());

  // Atlas filters
  const [atlasQ, setAtlasQ] = useState('');
  const [atlasNiche, setAtlasNiche] = useState('ALL');
  const [atlasDigitalOnly, setAtlasDigitalOnly] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelNiche, setNewChannelNiche] = useState('Money & Finance');

  // Press form
  const [pressKind, setPressKind] = useState<PressKind>('EBOOK');
  const [pressTitle, setPressTitle] = useState("The Quiet Compounder's Ledger");
  const [pressTopic, setPressTopic] = useState('Auditing recurring cash leaks and launching your first $15 digital edition');
  const [pressAudience, setPressAudience] = useState('Independent earners and first-time creators');
  const [pressChapters, setPressChapters] = useState(4);
  const [plannerDays, setPlannerDays] = useState<30 | 365>(30);
  const [pressBusy, setPressBusy] = useState(false);
  const [latestEdition, setLatestEdition] = useState<SavedEdition | null>(null);

  // Cinema / Packs form
  const [cinemaSubMode, setCinemaSubMode] = useState<'PACKS' | 'MUSIC_VIDEO'>('PACKS');
  const [packKind, setPackKind] = useState<PackKind>('FLOW_MOVIE');
  const [packTitle, setPackTitle] = useState('Midnight Courier — Episode 01');
  const [packPremise, setPackPremise] = useState('A bicycle courier discovers a coded brass key in the rain');
  const [packStyle, setPackStyle] = useState('35mm neo-noir rain reflections, warm amber & obsidian palette');
  const [packBusy, setPackBusy] = useState(false);
  const [latestPack, setLatestPack] = useState<SavedEdition | null>(null);

  // Music & Video Command Studio form
  const [musicPlatform, setMusicPlatform] = useState<MobileMusicPlatform>('ALL_PLATFORMS_MASTER');
  const [musicCloudHost, setMusicCloudHost] = useState<'COLAB' | 'KAGGLE'>('COLAB');
  const [musicEngine, setMusicEngine] = useState<'ACE_STEP_1_5' | 'DIFFRHYTHM' | 'MUSICGEN_MEDIUM'>('ACE_STEP_1_5');
  const [musicTitle, setMusicTitle] = useState('Ink Insight — Anthem');
  const [musicTheme, setMusicTheme] = useState('A story-driven rap track with uplifting chorus and cinematic rain visuals');
  const [musicGenre, setMusicGenre] = useState('Afrobeat / Boom-Bap Hip-Hop');
  const [musicMood, setMusicMood] = useState('Cinematic, Urgent, Inspiring');
  const [musicBpm, setMusicBpm] = useState(108);
  const [musicKey, setMusicKey] = useState('C minor');
  const [musicVocalMode, setMusicVocalMode] = useState<'VOCAL' | 'INSTRUMENTAL'>('VOCAL');
  const [musicAspect, setMusicAspect] = useState<'16:9' | '9:16'>('9:16');
  const [musicExclude, setMusicExclude] = useState('muffled mix, heavy distortion, off-beat drums');
  const [musicBusy, setMusicBusy] = useState(false);
  const [latestMusicResult, setLatestMusicResult] = useState<{
    edition: SavedEdition;
    copyPasteMasterPrompt: string;
    antigravityPrompt: string;
    codexPrompt: string;
  } | null>(null);
  const [copiedPromptTag, setCopiedPromptTag] = useState<string | null>(null);

  // Coach form
  const [coachInput, setCoachInput] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);

  // Key Vault form
  const [keyLabel, setKeyLabel] = useState('');
  const [keyProvider, setKeyProvider] = useState<MobileApiKey['provider']>('GEMINI');
  const [keySecret, setKeySecret] = useState('');
  const [keyBaseUrl, setKeyBaseUrl] = useState('');
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  // Desktop test status
  const [desktopStatus, setDesktopStatus] = useState<string>('');

  const showToast = (title: string, tone: 'info' | 'success' | 'error' = 'info') => {
    setToast({ title, tone });
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    applyTheme(themeMode);
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem('ntk-theme-mode') || 'system') === 'system') {
        applyTheme('system');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, [themeMode]);

  useEffect(() => {
    listEditions().then(setEditions).catch(() => {});
  }, []);

  useEffect(() => {
    window.__ntkOnHardwareBack = () => {
      if (helpOpen) {
        setHelpOpen(false);
        return true;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    };
  }, [helpOpen, drawerOpen, tab]);

  const setThemeMode = (next: ThemeMode) => {
    setThemeModeState(next);
    localStorage.setItem('ntk-theme-mode', next);
    applyTheme(next);
  };

  const setExpMode = (next: ExperienceMode) => {
    setExpModeState(next);
    localStorage.setItem('ntk-experience-mode', next);
  };

  const healthyKeysCount = keys.filter((k) => k.enabled && k.status === 'HEALTHY').length;

  const filteredChannels = useMemo(() => {
    const q = atlasQ.trim().toLowerCase();
    return channels.filter((c) => {
      if (atlasNiche !== 'ALL' && c.niche !== atlasNiche) return false;
      if (atlasDigitalOnly && !c.sellsDigitalProducts) return false;
      if (q) {
        const hay = `${c.name} ${c.handle} ${c.niche} ${c.digitalProductType || ''} ${c.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [channels, atlasQ, atlasNiche, atlasDigitalOnly]);

  const handlePressCreate = async () => {
    if (!pressTitle.trim()) {
      showToast('Please enter a title first', 'error');
      return;
    }
    setPressBusy(true);
    try {
      let out: { bytes: Uint8Array; fileName: string; summary: string; providerSummary: string };
      let mime = 'application/pdf';
      if (pressKind === 'EBOOK') {
        out = await buildEbookPdf({
          title: pressTitle.trim(),
          topic: pressTopic.trim(),
          audience: pressAudience.trim(),
          chaptersCount: pressChapters,
          authorName: 'NTK Hub',
        });
      } else if (pressKind === 'SPREADSHEET') {
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        out = await buildFormulaSpreadsheetXlsx({
          title: pressTitle.trim(),
          goal: pressTopic.trim(),
        });
      } else if (pressKind === 'PLANNER') {
        out = await buildPlannerPdf({
          title: pressTitle.trim(),
          theme: pressTopic.trim(),
          days: plannerDays,
        });
      } else {
        out = await buildJournalPdf({
          title: pressTitle.trim(),
          topic: pressTopic.trim(),
        });
      }

      const saved = await saveEdition({
        type: pressKind,
        title: pressTitle.trim(),
        fileName: out.fileName,
        mimeType: mime,
        bytes: out.bytes,
        summary: out.summary,
        providerSummary: out.providerSummary,
      });
      setLatestEdition(saved);
      setEditions(await listEditions());
      showToast(`${saved.fileName} created & saved to Vault`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Creation failed', 'error');
    } finally {
      setPressBusy(false);
    }
  };

  const handlePackCreate = async () => {
    if (!packTitle.trim()) {
      showToast('Please enter a project title', 'error');
      return;
    }
    setPackBusy(true);
    try {
      const out = await buildCinemaOrBrandZip({
        packType: packKind,
        title: packTitle.trim(),
        premise: packPremise.trim(),
        visualStyle: packStyle.trim(),
      });
      const saved = await saveEdition({
        type: packKind,
        title: packTitle.trim(),
        fileName: out.fileName,
        mimeType: 'application/zip',
        bytes: out.bytes,
        summary: out.summary,
        providerSummary: out.providerSummary,
      });
      setLatestPack(saved);
      setEditions(await listEditions());
      showToast(`${saved.fileName} ready in Vault`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Pack build failed', 'error');
    } finally {
      setPackBusy(false);
    }
  };

  const handleCopyText = async (tag: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedPromptTag(tag);
      showToast('Copied to clipboard', 'success');
      setTimeout(() => setCopiedPromptTag((prev) => (prev === tag ? null : prev)), 2000);
    } catch {
      showToast('Copy failed — use ZIP export instead', 'error');
    }
  };

  const handleMusicCreate = async () => {
    if (!musicTitle.trim()) {
      showToast('Please enter a track title', 'error');
      return;
    }
    setMusicBusy(true);
    try {
      const out = await buildMobileMusicVideoZip({
        platform: musicPlatform,
        cloudHost: musicCloudHost,
        colabEngine: musicEngine,
        title: musicTitle.trim(),
        theme: musicTheme.trim(),
        genre: musicGenre.trim(),
        mood: musicMood.trim(),
        bpm: Math.max(50, Math.min(200, Number(musicBpm) || 108)),
        musicalKey: musicKey.trim() || 'C minor',
        vocalMode: musicVocalMode,
        aspectRatio: musicAspect,
        excludeTraits: musicExclude.trim(),
      });
      const saved = await saveEdition({
        type: 'MUSIC_VIDEO_PACK',
        title: musicTitle.trim(),
        fileName: out.fileName,
        mimeType: 'application/zip',
        bytes: out.bytes,
        summary: out.summary,
        providerSummary: out.providerSummary,
      });
      setLatestMusicResult({
        edition: saved,
        copyPasteMasterPrompt: out.copyPasteMasterPrompt,
        antigravityPrompt: out.antigravityPrompt,
        codexPrompt: out.codexPrompt,
      });
      setEditions(await listEditions());
      showToast(`${saved.fileName} ready in Vault`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Music & Video bundle failed', 'error');
    } finally {
      setMusicBusy(false);
    }
  };

  const handleCoachSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = coachInput.trim();
    if (!prompt) return;
    const userMsg: CoachMessage = {
      id: makeId('msg'),
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    const nextList = [...coachMessages, userMsg];
    setCoachMessages(nextList);
    saveCoachMessages(nextList);
    setCoachInput('');
    setCoachBusy(true);

    const res = await generateMobileAI(
      `You are the NTK Editorial Hook Coach. Give 3 crisp, concrete YouTube hooks, 1 digital product tie-in, and 1 retention tip for:\n${prompt}`,
      false
    );
    const replyText = res.ok && res.text
      ? res.text
      : `Zero-Key Hook Blueprint for "${prompt}":\n\n1. Contrarian Hook: "Everyone tells you to start with gear, yet the top channels in this niche win with one $0 script rule."\n2. Curiosity Open Loop: "Watch the first 15 seconds of this breakdown—especially step #3."\n3. Digital Product Tie-In: Link a companion 1-page PDF checklist or Excel calculator in your pinned comment.\n\n(Add a free Gemini/Groq/OpenRouter key in API Key Vault for live AI coaching!)`;

    const assistantMsg: CoachMessage = {
      id: makeId('msg'),
      role: 'assistant',
      content: replyText,
      provider: res.providerSummary,
      createdAt: new Date().toISOString(),
    };
    const finalList = [...nextList, assistantMsg];
    setCoachMessages(finalList);
    saveCoachMessages(finalList);
    setKeys(loadMobileKeys());
    setCoachBusy(false);
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim() || !keySecret.trim()) return;
    const nextKey: MobileApiKey = {
      id: makeId('key'),
      label: keyLabel.trim(),
      provider: keyProvider,
      apiKey: keySecret.trim(),
      baseUrl: keyBaseUrl.trim() || undefined,
      enabled: true,
      priority: keyProvider === 'GEMINI' ? 10 : 20,
      status: 'HEALTHY',
    };
    const next = [nextKey, ...keys];
    setKeys(next);
    saveMobileKeys(next);
    setKeyLabel('');
    setKeySecret('');
    setKeyBaseUrl('');
    showToast('API key saved securely on device', 'success');
  };

  const handleTestKey = async (k: MobileApiKey) => {
    setTestingKeyId(k.id);
    const res = await testMobileKey(k);
    const next = keys.map((item) =>
      item.id === k.id
        ? { ...item, status: res.ok ? ('HEALTHY' as const) : ('INVALID' as const), lastError: res.ok ? null : res.message }
        : item
    );
    setKeys(next);
    saveMobileKeys(next);
    setTestingKeyId(null);
    showToast(res.ok ? `Verified: ${res.message}` : `Failed: ${res.message}`, res.ok ? 'success' : 'error');
  };

  const handleExportEdition = (ed: SavedEdition, action: 'save' | 'share') => {
    const bytes = editionToUint8(ed);
    const result = exportFileToDevice(ed.fileName, ed.mimeType, bytes, action);
    showToast(result.message, 'success');
  };

  const handleDeleteEdition = async (id: string) => {
    await deleteEdition(id);
    setEditions(await listEditions());
    if (latestEdition?.id === id) setLatestEdition(null);
    if (latestPack?.id === id) setLatestPack(null);
    showToast('Removed from Vault', 'info');
  };

  const handleTestDesktopLink = async () => {
    const clean = desktopUrl.trim().replace(/\/+$/, '');
    if (!clean) return;
    saveDesktopServerUrl(clean);
    setDesktopStatus('Testing connection...');
    const res = await nativeHttpRequest(`${clean}/api/dashboard`, { timeoutMs: 6000 });
    if (res.ok) {
      setDesktopStatus('Connected to your Desktop NTK Creator Command!');
      showToast('Desktop Atelier connected', 'success');
    } else {
      setDesktopStatus(`Could not reach ${clean} (${res.error || res.status}). Make sure desktop app is running on the same Wi-Fi.`);
    }
  };

  const deviceInfo = getDeviceInfo();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight truncate">
              NTK Creator Command
            </div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent-text)] font-semibold">
              {expMode === 'guided' ? 'Guided Mobile Atelier' : 'Pro Mobile Studio'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Open quick guide"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium min-h-[36px]"
          >
            <HelpCircle className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            <span>Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('keys')}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium min-h-[36px]"
          >
            <Activity className={`h-3.5 w-3.5 ${healthyKeysCount > 0 ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`} />
            <span>{healthyKeysCount > 0 ? `AI (${healthyKeysCount})` : 'Zero-Key'}</span>
          </button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed top-16 left-3 right-3 z-50 rounded-xl border px-3.5 py-2.5 text-xs font-semibold shadow-lg ${
            toast.tone === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
              : toast.tone === 'error'
              ? 'bg-rose-950/95 border-rose-500/50 text-rose-100'
              : 'bg-[var(--bg-surface)] border-[var(--border-accent)] text-[var(--text-primary)]'
          }`}
        >
          {toast.title}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 px-3.5 pt-4 pb-24 max-w-2xl w-full mx-auto space-y-5">
        {tab === 'home' && (
          <div className="space-y-5" data-testid="mobile-home">
            <div className="rounded-2xl border border-[var(--border-accent)] atelier-hero-bg bg-[var(--bg-surface)] p-5 space-y-4">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
                <Sparkles className="h-3 w-3" /> Works 100% On Your Phone
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight">
                Build something worth owning.
              </h1>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Pick a step below. You write zero code, pay zero monthly fees, and save finished PDFs, Excel trackers, and prompt ZIPs straight to your phone.
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    num: '01',
                    title: 'Spot Proven Channels & Products',
                    sub: '30 benchmarked faceless channels',
                    target: 'atlas' as TabId,
                    icon: Radar,
                  },
                  {
                    num: '02',
                    title: 'Press a Digital Ebook or Excel Sheet',
                    sub: 'Creates real .PDF or .XLSX on your phone',
                    target: 'press' as TabId,
                    icon: Package,
                  },
                  {
                    num: '03',
                    title: 'Build a Cinema or Brand Pack (.ZIP)',
                    sub: 'Ordered prompts, continuity & scripts',
                    target: 'cinema' as TabId,
                    icon: Film,
                  },
                  {
                    num: '04',
                    title: 'Open Saved Files & Share',
                    sub: `${editions.length} saved item(s) in your Vault`,
                    target: 'vault' as TabId,
                    icon: FolderArchive,
                  },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.num}
                      type="button"
                      onClick={() => setTab(step.target)}
                      className="w-full text-left rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-display text-2xl font-bold text-[var(--accent-text)] shrink-0">
                          {step.num}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold flex items-center gap-1.5">
                            <Icon className="h-4 w-4 text-[var(--accent-text)] shrink-0" />
                            <span className="truncate">{step.title}</span>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] truncate">{step.sub}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[var(--accent-text)] shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  {healthyKeysCount > 0 ? `${healthyKeysCount} AI key(s) ready` : 'Zero-Key Mode Active'}
                </div>
                <div className="text-[var(--text-secondary)]">
                  Add free Gemini/Groq/OpenRouter keys anytime or use built-in templates.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab('keys')}
                className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-text)] shrink-0"
              >
                Keys
              </button>
            </div>
          </div>
        )}

        {tab === 'atlas' && (
          <div className="space-y-4" data-testid="mobile-atlas">
            <div>
              <h1 className="font-display text-2xl font-bold">Opportunity Atlas</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Explore {channels.length} faceless channels and see what digital products they sell.
              </p>
            </div>

            <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-3">
              <input
                type="text"
                value={atlasQ}
                onChange={(e) => setAtlasQ(e.target.value)}
                placeholder="Search channels, niches, or digital products..."
                className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={atlasNiche}
                  onChange={(e) => setAtlasNiche(e.target.value)}
                  className="rounded-xl border bg-[var(--bg-elevated)] px-3 py-2.5 text-xs font-medium"
                >
                  <option value="ALL">All Niches</option>
                  <option value="Money & Finance">Money & Finance</option>
                  <option value="History">History</option>
                  <option value="Stories">Stories</option>
                  <option value="Science & Space">Science & Space</option>
                  <option value="Stickman Explainers">Stickman Explainers</option>
                  <option value="AI Movies">AI Movies</option>
                </select>
                <button
                  type="button"
                  onClick={() => setAtlasDigitalOnly(!atlasDigitalOnly)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                    atlasDigitalOnly
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  }`}
                >
                  {atlasDigitalOnly ? 'Sells Products: ON' : 'Sells Products Only'}
                </button>
              </div>
              {expMode === 'pro' && (
                <div className="pt-2 border-t flex gap-2">
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="Track new channel @handle..."
                    className="flex-1 rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                  />
                  <select
                    value={newChannelNiche}
                    onChange={(e) => setNewChannelNiche(e.target.value)}
                    className="rounded-xl border bg-[var(--bg-elevated)] px-2 py-2 text-xs"
                  >
                    <option value="Money & Finance">Finance</option>
                    <option value="AI Movies">AI Movies</option>
                    <option value="Stories">Stories</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newChannelName.trim()) return;
                      const clean = newChannelName.trim();
                      const handle = clean.startsWith('@') ? clean : `@${clean.toLowerCase().replace(/\s+/g, '')}`;
                      const next = addCustomChannel({
                        id: makeId('ch'),
                        name: clean.replace(/^@/, ''),
                        handle,
                        url: `https://www.youtube.com/${handle}`,
                        niche: newChannelNiche,
                        videoStyle: 'Documentary',
                        subscribers: 12000,
                        uploadsPerWeek: 2,
                        avgLengthMin: 10,
                        startedDate: new Date().toISOString().slice(0, 10),
                        estMonthlyViews: 85000,
                        estMonthlyAdSense: 650,
                        monetizationConfirmed: true,
                        sellsDigitalProducts: false,
                        digitalProductUrl: null,
                        digitalProductType: null,
                        notes: 'Added locally on mobile.',
                      });
                      setChannels(next);
                      setNewChannelName('');
                      showToast('Channel added to Atlas', 'success');
                    }}
                    className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] px-3 py-2 text-xs font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {filteredChannels.map((ch) => (
                <div key={ch.id} className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{ch.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {ch.handle} · {ch.niche} · {ch.videoStyle}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openExternalLink(ch.url)}
                      aria-label={`Open ${ch.name}`}
                      className="p-2 rounded-lg border bg-[var(--bg-elevated)] text-[var(--accent-text)] shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[var(--bg-elevated)] p-2">
                      <div className="text-[10px] text-[var(--text-secondary)]">Subscribers</div>
                      <div className="text-xs font-bold">{ch.subscribers.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-elevated)] p-2">
                      <div className="text-[10px] text-[var(--text-secondary)]">Views/mo</div>
                      <div className="text-xs font-bold">{ch.estMonthlyViews.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-elevated)] p-2">
                      <div className="text-[10px] text-[var(--text-secondary)]">Est. AdSense</div>
                      <div className="text-xs font-bold text-emerald-500">${ch.estMonthlyAdSense.toLocaleString()}</div>
                    </div>
                  </div>
                  {ch.sellsDigitalProducts && (
                    <div className="rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs flex items-center justify-between gap-2">
                      <span className="truncate">
                        <strong className="text-[var(--accent-text)]">Offer:</strong> {ch.digitalProductType}
                      </span>
                      {ch.digitalProductUrl && (
                        <button
                          type="button"
                          onClick={() => openExternalLink(ch.digitalProductUrl!)}
                          className="text-[var(--accent-text)] font-semibold shrink-0"
                        >
                          View
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'press' && (
          <div className="space-y-4" data-testid="mobile-press">
            <div>
              <h1 className="font-display text-2xl font-bold">Digital Press Studio</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Create real PDF ebooks, Excel formula spreadsheets, or planners directly on your phone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'EBOOK' as PressKind, label: 'Ebook PDF', icon: BookText },
                { id: 'SPREADSHEET' as PressKind, label: 'Excel (.xlsx)', icon: FileSpreadsheet },
                { id: 'PLANNER' as PressKind, label: 'Planner PDF', icon: CalendarDays },
                { id: 'JOURNAL' as PressKind, label: 'Workbook PDF', icon: NotebookPen },
              ].map((item) => {
                const Icon = item.icon;
                const active = pressKind === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`press-kind-${item.id}`}
                    onClick={() => setPressKind(item.id)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px] ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={pressTitle}
                  onChange={(e) => setPressTitle(e.target.value)}
                  className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Topic / Goal
                </label>
                <textarea
                  rows={2}
                  value={pressTopic}
                  onChange={(e) => setPressTopic(e.target.value)}
                  className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                />
              </div>
              {pressKind === 'EBOOK' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Audience
                    </label>
                    <input
                      type="text"
                      value={pressAudience}
                      onChange={(e) => setPressAudience(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Chapters
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={8}
                      value={pressChapters}
                      onChange={(e) => setPressChapters(Math.min(8, Math.max(3, Number(e.target.value) || 4)))}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              )}
              {pressKind === 'PLANNER' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    Planner Duration
                  </label>
                  <select
                    value={String(plannerDays)}
                    onChange={(e) => setPlannerDays(Number(e.target.value) === 365 ? 365 : 30)}
                    className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2.5 text-xs"
                  >
                    <option value="30">30-Day Fast Build PDF</option>
                    <option value="365">365-Day Full-Year Edition PDF</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                disabled={pressBusy}
                onClick={handlePressCreate}
                data-testid="mobile-press-create"
                className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 min-h-[46px] disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>{pressBusy ? 'Building File...' : `Create ${pressKind === 'SPREADSHEET' ? '.XLSX Workbook' : '.PDF File'}`}</span>
              </button>
            </div>

            {latestEdition && (
              <div className="rounded-2xl border border-emerald-500/40 bg-[var(--bg-surface)] p-4 space-y-3" data-testid="latest-press-result">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Ready: {latestEdition.fileName}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {Math.max(1, Math.round(latestEdition.bytes / 1024))} KB · {latestEdition.providerSummary}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportEdition(latestEdition, 'save')}
                    className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Download className="h-4 w-4" /> Save to Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportEdition(latestEdition, 'share')}
                    className="rounded-xl border bg-[var(--bg-elevated)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="h-4 w-4" /> Share File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'cinema' && (
          <div className="space-y-4" data-testid="mobile-cinema">
            <div>
              <h1 className="font-display text-2xl font-bold">Cinema &amp; Music Studio</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Compile video prompt packs, multi-platform music prompts, binary MIDI guides, and working Colab/Kaggle notebooks into a clean .ZIP.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="cinema-submode-packs"
                onClick={() => setCinemaSubMode('PACKS')}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  cinemaSubMode === 'PACKS'
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                <Film className="h-4 w-4" />
                <span>Video &amp; Packs</span>
              </button>
              <button
                type="button"
                data-testid="cinema-submode-music"
                onClick={() => setCinemaSubMode('MUSIC_VIDEO')}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  cinemaSubMode === 'MUSIC_VIDEO'
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                }`}
              >
                <Music className="h-4 w-4" />
                <span>Music + Video Studio</span>
              </button>
            </div>

            {cinemaSubMode === 'PACKS' ? (
              <>
                <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Pack Type
                    </label>
                    <select
                      value={packKind}
                      onChange={(e) => setPackKind(e.target.value as PackKind)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
                    >
                      <option value="FLOW_MOVIE">Flow Cinema Movie Pack</option>
                      <option value="FLOW_BULK">Visual Style Cloner Pack</option>
                      <option value="BRAND_PACK">Brand &amp; Ad Intelligence Pack</option>
                      <option value="NOTEBOOK_PACK">Cloud GPU Lab Pack</option>
                      <option value="PUBLISH_PACK">Safe Release Upload Pack</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Project Title
                    </label>
                    <input
                      type="text"
                      value={packTitle}
                      onChange={(e) => setPackTitle(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Story Premise / Topic
                    </label>
                    <textarea
                      rows={2}
                      value={packPremise}
                      onChange={(e) => setPackPremise(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Visual Style Anchor
                    </label>
                    <input
                      type="text"
                      value={packStyle}
                      onChange={(e) => setPackStyle(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={packBusy}
                    onClick={handlePackCreate}
                    data-testid="mobile-pack-create"
                    className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 min-h-[46px] disabled:opacity-50"
                  >
                    <Film className="h-4 w-4" />
                    <span>{packBusy ? 'Packing ZIP...' : 'Create Production .ZIP'}</span>
                  </button>
                </div>

                {latestPack && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-[var(--bg-surface)] p-4 space-y-3" data-testid="latest-pack-result">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" /> Ready: {latestPack.fileName}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportEdition(latestPack, 'save')}
                        className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-4 w-4" /> Save ZIP
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportEdition(latestPack, 'share')}
                        className="rounded-xl border bg-[var(--bg-elevated)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="h-4 w-4" /> Share ZIP
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-3.5" data-testid="mobile-music-form">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Target Music &amp; Video Platform
                    </label>
                    <select
                      value={musicPlatform}
                      onChange={(e) => setMusicPlatform(e.target.value as MobileMusicPlatform)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
                    >
                      <option value="ALL_PLATFORMS_MASTER">All Platforms Master (Flow + Suno + Treblo + ACE + Colab)</option>
                      <option value="GOOGLE_FLOW">Google Flow Music (Lyria 3.5 + Veo)</option>
                      <option value="SUNO">Suno v4/v4.5 (Style ≤1000 chars + Video)</option>
                      <option value="TREBLO">Treblo (formerly Sonauto)</option>
                      <option value="ACE_STUDIO">ACE Studio (Vocal + Binary MIDI)</option>
                      <option value="UDIO">Udio (Tag Style + Cover Video)</option>
                      <option value="MUREKA">Mureka (Brief ≤1024 chars)</option>
                      <option value="RIFFUSION">Riffusion / Producer.ai (Vibe ≤120 chars)</option>
                      <option value="ELEVENLABS_MUSIC">ElevenLabs Music &amp; Voiceover</option>
                      <option value="COLAB_KAGGLE_OPEN">Free Cloud GPU (Colab / Kaggle)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Cloud Host
                      </label>
                      <select
                        value={musicCloudHost}
                        onChange={(e) => setMusicCloudHost(e.target.value as 'COLAB' | 'KAGGLE')}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-2.5 py-2 text-xs"
                      >
                        <option value="COLAB">Google Colab (T4)</option>
                        <option value="KAGGLE">Kaggle (P100/T4)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Open-Source Engine
                      </label>
                      <select
                        value={musicEngine}
                        onChange={(e) => setMusicEngine(e.target.value as 'ACE_STEP_1_5' | 'DIFFRHYTHM' | 'MUSICGEN_MEDIUM')}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-2.5 py-2 text-xs"
                      >
                        <option value="ACE_STEP_1_5">ACE-Step 1.5 (T4 Float32)</option>
                        <option value="DIFFRHYTHM">DiffRhythm (Fast Song)</option>
                        <option value="MUSICGEN_MEDIUM">MusicGen-Medium</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Track / Video Title
                    </label>
                    <input
                      type="text"
                      value={musicTitle}
                      onChange={(e) => setMusicTitle(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Story Theme &amp; Lyrics Direction
                    </label>
                    <textarea
                      rows={2}
                      value={musicTheme}
                      onChange={(e) => setMusicTheme(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Genre
                      </label>
                      <input
                        type="text"
                        value={musicGenre}
                        onChange={(e) => setMusicGenre(e.target.value)}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Mood
                      </label>
                      <input
                        type="text"
                        value={musicMood}
                        onChange={(e) => setMusicMood(e.target.value)}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-secondary)] mb-1">BPM</label>
                      <input
                        type="number"
                        min={50}
                        max={200}
                        value={musicBpm}
                        onChange={(e) => setMusicBpm(Number(e.target.value))}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-2.5 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-secondary)] mb-1">Key</label>
                      <input
                        type="text"
                        value={musicKey}
                        onChange={(e) => setMusicKey(e.target.value)}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-2.5 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-secondary)] mb-1">Vocals</label>
                      <select
                        value={musicVocalMode}
                        onChange={(e) => setMusicVocalMode(e.target.value as 'VOCAL' | 'INSTRUMENTAL')}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-2 py-2 text-xs"
                      >
                        <option value="VOCAL">Vocal</option>
                        <option value="INSTRUMENTAL">Inst.</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-secondary)] mb-1">Ratio</label>
                      <select
                        value={musicAspect}
                        onChange={(e) => setMusicAspect(e.target.value as '16:9' | '9:16')}
                        className="w-full rounded-xl border bg-[var(--bg-elevated)] px-2 py-2 text-xs"
                      >
                        <option value="9:16">9:16</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Exclude Traits
                    </label>
                    <input
                      type="text"
                      value={musicExclude}
                      onChange={(e) => setMusicExclude(e.target.value)}
                      className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={musicBusy}
                    onClick={handleMusicCreate}
                    data-testid="mobile-music-create"
                    className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 min-h-[46px] disabled:opacity-50"
                  >
                    <Music className="h-4 w-4" />
                    <span>{musicBusy ? 'Building Music + Video Bundle...' : 'Generate Complete Music & Video .ZIP'}</span>
                  </button>
                </div>

                {latestMusicResult && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-[var(--bg-surface)] p-4 space-y-3" data-testid="latest-music-result">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" /> Ready: {latestMusicResult.edition.fileName}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText('master', latestMusicResult.copyPasteMasterPrompt)}
                        className="rounded-xl border bg-[var(--bg-elevated)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        {copiedPromptTag === 'master' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        <span>{copiedPromptTag === 'master' ? 'Copied Complete Prompt' : 'Copy Complete Prompt (All Platforms)'}</span>
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyText('antigravity', latestMusicResult.antigravityPrompt)}
                          className="rounded-xl border bg-[var(--bg-elevated)] py-2 px-2.5 text-[11px] font-semibold flex items-center justify-center gap-1"
                        >
                          {copiedPromptTag === 'antigravity' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Antigravity Prompt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText('codex', latestMusicResult.codexPrompt)}
                          className="rounded-xl border bg-[var(--bg-elevated)] py-2 px-2.5 text-[11px] font-semibold flex items-center justify-center gap-1"
                        >
                          {copiedPromptTag === 'codex' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Codex Prompt</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportEdition(latestMusicResult.edition, 'save')}
                        className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-4 w-4" /> Save .ZIP
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportEdition(latestMusicResult.edition, 'share')}
                        className="rounded-xl border bg-[var(--bg-elevated)] py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="h-4 w-4" /> Share .ZIP
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'vault' && (
          <div className="space-y-4" data-testid="mobile-vault">
            <div>
              <h1 className="font-display text-2xl font-bold">My Editions Vault</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Every PDF, Excel workbook, and ZIP pack created on this device stays here.
              </p>
            </div>

            {editions.length === 0 ? (
              <div className="rounded-2xl border bg-[var(--bg-surface)] p-8 text-center space-y-3">
                <FolderArchive className="h-8 w-8 mx-auto text-[var(--text-secondary)] opacity-60" />
                <div className="text-xs text-[var(--text-secondary)]">
                  No files created yet. Open Press or Cinema below to create your first edition.
                </div>
                <button
                  type="button"
                  onClick={() => setTab('press')}
                  className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] px-4 py-2 text-xs font-semibold"
                >
                  Open Digital Press
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {editions.map((ed) => (
                  <div key={ed.id} className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-block rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-text)] mb-1">
                          {ed.type}
                        </span>
                        <div className="font-bold text-sm truncate">{ed.title}</div>
                        <div className="text-[11px] font-mono text-[var(--text-secondary)] truncate">
                          {ed.fileName} · {Math.max(1, Math.round(ed.bytes / 1024))} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEdition(ed.id)}
                        aria-label={`Delete ${ed.title}`}
                        className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportEdition(ed, 'save')}
                        className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportEdition(ed, 'share')}
                        className="rounded-xl border bg-[var(--bg-elevated)] py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'coach' && (
          <div className="space-y-4" data-testid="mobile-coach">
            <div>
              <h1 className="font-display text-2xl font-bold">Editorial Hook Coach</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Ask for opening hooks, video angles, or digital product tie-ins.
              </p>
            </div>
            <div className="space-y-3">
              {coachMessages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-3.5 text-xs whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[var(--accent-soft)] border-[var(--border-accent)] ml-6'
                      : 'bg-[var(--bg-surface)] mr-6'
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                    {m.role === 'user' ? 'You' : `Coach · ${m.provider || 'Local'}`}
                  </div>
                  {m.content}
                </div>
              ))}
            </div>
            <form onSubmit={handleCoachSend} className="flex gap-2">
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                placeholder="Ask e.g. 3 hooks for a budgeting channel..."
                className="flex-1 rounded-xl border bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={coachBusy}
                className="rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] px-4 py-2.5 text-sm font-semibold shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {tab === 'keys' && (
          <div className="space-y-4" data-testid="mobile-keys">
            <div>
              <h1 className="font-display text-2xl font-bold">API Key Vault</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Keys stay encrypted on your phone and rotate automatically if one hits a rate limit.
              </p>
            </div>

            <form onSubmit={handleAddKey} className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-3">
              <input
                type="text"
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                placeholder="Label (e.g. My Free Gemini Key)"
                required
                className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
              />
              <select
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value as MobileApiKey['provider'])}
                className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
              >
                <option value="GEMINI">GEMINI (Google AI Studio)</option>
                <option value="GROQ">GROQ (Ultra-Fast)</option>
                <option value="OPENROUTER">OPENROUTER (:free models)</option>
                <option value="CUSTOM">CUSTOM OpenAI-compatible</option>
                <option value="YOUTUBE">YOUTUBE Data API v3</option>
              </select>
              {keyProvider === 'CUSTOM' && (
                <input
                  type="url"
                  value={keyBaseUrl}
                  onChange={(e) => setKeyBaseUrl(e.target.value)}
                  placeholder="Base URL (https://api.example.com/v1)"
                  className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
                />
              )}
              <input
                type="password"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder="Paste API key..."
                required
                className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-3 text-sm font-semibold"
              >
                Save Key Securely
              </button>
            </form>

            <div className="space-y-2.5">
              {keys.length === 0 ? (
                <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-secondary)]">
                  No keys added yet. The app still works offline in Zero-Key Mode using built-in templates.
                </div>
              ) : (
                keys.map((k) => (
                  <div key={k.id} className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm">{k.label}</div>
                        <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {k.provider} · {maskKey(k.apiKey)} · {k.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = keys.filter((x) => x.id !== k.id);
                          setKeys(next);
                          saveMobileKeys(next);
                          showToast('Key removed', 'info');
                        }}
                        className="p-2 text-rose-400"
                        aria-label="Delete key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {k.lastError && <div className="text-[11px] text-rose-400">{k.lastError}</div>}
                    <button
                      type="button"
                      disabled={testingKeyId === k.id}
                      onClick={() => handleTestKey(k)}
                      className="rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      {testingKeyId === k.id ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'desktop' && (
          <div className="space-y-4" data-testid="mobile-desktop-link">
            <div>
              <h1 className="font-display text-2xl font-bold">Optional Desktop Link</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                This phone app already works 100% standalone. If you also run NTK Creator Command on Windows or Linux over Wi-Fi, test the link here.
              </p>
            </div>
            <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 space-y-3">
              <input
                type="url"
                value={desktopUrl}
                onChange={(e) => setDesktopUrl(e.target.value)}
                placeholder="http://192.168.1.50:3000"
                className="w-full rounded-xl border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={handleTestDesktopLink}
                className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Link2 className="h-4 w-4" /> Test Desktop Connection
              </button>
              {desktopStatus && <div className="text-xs text-[var(--text-secondary)]">{desktopStatus}</div>}
            </div>
            {deviceInfo.androidRelease && (
              <div className="rounded-2xl border bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-secondary)]">
                Android {deviceInfo.androidRelease} (API {deviceInfo.apiLevel}) · App v{deviceInfo.appVersion}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed Mobile Bottom Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-5 h-16 max-w-2xl mx-auto">
          {[
            { id: 'home' as TabId, label: 'Home', icon: LayoutDashboard },
            { id: 'atlas' as TabId, label: 'Atlas', icon: Radar },
            { id: 'press' as TabId, label: 'Press', icon: Package },
            { id: 'cinema' as TabId, label: 'Cinema', icon: Film },
            { id: 'vault' as TabId, label: 'Vault', icon: FolderArchive },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? 'text-[var(--accent-text)] font-semibold' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Slide-out Navigation & Settings Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative z-10 w-80 max-w-[85vw] bg-[var(--bg-surface)] border-r h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-display text-lg font-bold">Atelier Menu</div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {[
                { id: 'home' as TabId, label: 'Atelier Home', icon: LayoutDashboard },
                { id: 'atlas' as TabId, label: 'Opportunity Atlas (30 Channels)', icon: Radar },
                { id: 'press' as TabId, label: 'Digital Press (PDF & Excel)', icon: Package },
                { id: 'cinema' as TabId, label: 'Cinema & Pack Studio (.ZIP)', icon: Film },
                { id: 'vault' as TabId, label: 'My Editions Vault', icon: FolderArchive },
                { id: 'coach' as TabId, label: 'Editorial Hook Coach', icon: Flame },
                { id: 'keys' as TabId, label: 'API Key Vault', icon: KeyRound },
                { id: 'desktop' as TabId, label: 'Optional Desktop Wi-Fi Link', icon: Compass },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold text-left ${
                      tab === item.id
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t space-y-2.5">
              <div className="rounded-xl border bg-[var(--bg-elevated)] p-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => setExpMode('guided')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${
                    expMode === 'guided' ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Guided Mode
                </button>
                <button
                  type="button"
                  onClick={() => setExpMode('pro')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${
                    expMode === 'pro' ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Pro Mode
                </button>
              </div>
              <div className="rounded-xl border bg-[var(--bg-elevated)] p-1 flex gap-1">
                {[
                  { id: 'system' as ThemeMode, label: 'System', icon: Monitor },
                  { id: 'light' as ThemeMode, label: 'Light', icon: Sun },
                  { id: 'dark' as ThemeMode, label: 'Dark', icon: Moon },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setThemeMode(opt.id)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1 ${
                        themeMode === opt.id ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Quick Guide Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setHelpOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-2xl border bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg font-bold">Atelier Quick Guide</div>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close guide" className="p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              <p>
                <strong className="text-[var(--text-primary)]">1. Explore:</strong> Check <strong>Atlas</strong> to see real faceless channels and which digital products they sell.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">2. Create:</strong> Open <strong>Press</strong> to create a real PDF book, Excel sheet, or planner, or <strong>Cinema</strong> for prompt ZIPs.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">3. Save &amp; Share:</strong> Every file stays in <strong>Vault</strong> so you can save it to your phone Downloads or share it anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] py-2.5 text-sm font-semibold"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
