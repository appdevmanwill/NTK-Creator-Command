'use client';

import React, { useState } from 'react';
import { BookText, CalendarDays, Download, FileSpreadsheet, NotebookPen, Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PausedQuotaState, PackResultViewer } from '@/components/PackResultViewer';
import { AdvancedOptionsToggle, NextStepCard, StudioStarterBanner } from '@/components/GuidedHelpers';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

type StudioTab = 'EBOOK' | 'SPREADSHEET' | 'PLANNER' | 'JOURNAL';

const CHART_COLORS = ['#9E7318', '#D4AF37', '#2F6F5E', '#6E5A4F', '#B45309', '#3F4B5B'];

export default function DigitalProductsStudioPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<StudioTab>('EBOOK');
  const [loading, setLoading] = useState(false);

  // Ebook 8-input form
  const [ebookTitle, setEbookTitle] = useState("The Quiet Compounder's Ledger");
  const [ebookTopic, setEbookTopic] = useState('Auditing recurring cash leaks, redirecting weekly surplus, and shipping your first $15 digital edition');
  const [illustrationMode, setIllustrationMode] = useState<'FLAT_SVG' | 'PLACEHOLDER_PROMPTS'>('FLAT_SVG');
  const [chapterCount, setChapterCount] = useState(4);
  const [ebookColor, setEbookColor] = useState('#9E7318');
  const [authorName, setAuthorName] = useState('NTK Hub');
  const [writingStyle, setWritingStyle] = useState('Crisp, editorial, high-clarity guidance');
  const [ebookAudience, setEbookAudience] = useState('Independent earners and first-time creators');

  // Spreadsheet form
  const [sheetTitle, setSheetTitle] = useState('Sovereign Paycheck & Allocation Model');
  const [sheetPrompt, setSheetPrompt] = useState('Track digital edition revenue, platform fees, fixed obligations, reserves, and monthly net margin');
  const [sheetAudience, setSheetAudience] = useState('Solo digital publishers');
  const [sheetComplexity, setSheetComplexity] = useState<'SIMPLE' | 'STANDARD' | 'ADVANCED'>('STANDARD');
  const [sheetColor, setSheetColor] = useState('#141210');

  // Planner form
  const [plannerTitle, setPlannerTitle] = useState('Thirty Days of Quiet Momentum');
  const [plannerTheme, setPlannerTheme] = useState('Protected morning deep work, intentional spending, and daily execution discipline');
  const [durationDays, setDurationDays] = useState<30 | 365>(30);
  const [layoutStyle, setLayoutStyle] = useState('Editorial Ruled Grid');
  const [plannerColor, setPlannerColor] = useState('#9E7318');

  // Journal form
  const [journalTitle, setJournalTitle] = useState('The Calm Ledger Reflection Edition');
  const [journalType, setJournalType] = useState('Financial Clarity & Decision Workbook');
  const [journalTopic, setJournalTopic] = useState('Weekly spending reviews, impulse-pause prompts, and quarterly savings milestones');
  const [journalColor, setJournalColor] = useState('#9E7318');

  const [pausedQuota, setPausedQuota] = useState<PausedQuotaState | null>(null);
  const [artifact, setArtifact] = useState<{
    kind: StudioTab;
    projectId: string;
    fileName: string;
    bytes: number;
    pdfEngine?: string;
    providerSummary?: string;
    previewChapters?: Array<{ number: number; title: string; personalStoryTip: string }>;
    spreadsheetPreview?: {
      chartSummary: Array<{ category: string; total: number }>;
      totalIncome: number;
      totalExpense: number;
      netBalance: number;
      rows: Array<{ date: string; description: string; category: string; type: string; amount: number }>;
    };
  } | null>(null);

  const generateProduct = async (resumeJobId?: string) => {
    setLoading(true);
    setPausedQuota(null);
    setArtifact(null);
    try {
      const payload =
        tab === 'EBOOK'
          ? {
              kind: 'EBOOK',
              existingJobId: resumeJobId,
              title: ebookTitle,
              topic: ebookTopic,
              illustrationMode,
              chapterCount,
              brandColor: ebookColor,
              authorName,
              writingStyle,
              audience: ebookAudience,
            }
          : tab === 'SPREADSHEET'
          ? {
              kind: 'SPREADSHEET',
              title: sheetTitle,
              prompt: sheetPrompt,
              audience: sheetAudience,
              complexity: sheetComplexity,
              brandColor: sheetColor,
            }
          : tab === 'PLANNER'
          ? {
              kind: 'PLANNER',
              title: plannerTitle,
              theme: plannerTheme,
              durationDays,
              layoutStyle,
              brandColor: plannerColor,
            }
          : {
              kind: 'JOURNAL',
              title: journalTitle,
              journalType,
              topic: journalTopic,
              brandColor: journalColor,
            };

      const res = await fetch('/api/products/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 429 && data.status === 'PAUSED_QUOTA') {
        setPausedQuota(data);
        pushToast({ title: 'Ebook paused cleanly at checkpoint', tone: 'info' });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setArtifact({ kind: tab, ...data });
      pushToast({
        title: `${data.fileName} ready (${Math.round(data.bytes / 1024)} KB)`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const tabs: Array<{ id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'EBOOK', label: 'AI Ebook Writer (PDF)', icon: BookText },
    { id: 'SPREADSHEET', label: 'Formula Spreadsheet (.xlsx)', icon: FileSpreadsheet },
    { id: 'PLANNER', label: 'Digital Planners (PDF)', icon: CalendarDays },
    { id: 'JOURNAL', label: 'Journals & Workbooks (PDF)', icon: NotebookPen },
  ];

  const activeTitle =
    tab === 'EBOOK'
      ? ebookTitle
      : tab === 'SPREADSHEET'
      ? sheetTitle
      : tab === 'PLANNER'
      ? plannerTitle
      : journalTitle;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Press Studio"
        subtitle="Select a publication format, define your premise or spark one with AI, and compile a finished PDF edition or formula workbook."
        badge="Local Editorial Engine"
      />

      <StudioStarterBanner
        whatYouGet="A print-editorial PDF monograph, auto-calculating Excel (.xlsx) financial model, 30/365-day hyperlinked planner, or guided workbook stored directly on disk."
        safeNote="100% local · Zero subscription fees"
        samples={[
          {
            label: "Quiet Compounder's Ledger (PDF)",
            onApply: () => {
              setTab('EBOOK');
              setEbookTitle("The Quiet Compounder's Ledger");
              setEbookTopic('Auditing recurring cash leaks, redirecting weekly surplus, and shipping your first $15 digital edition');
              pushToast({ title: 'Loaded Ebook edition preset', tone: 'info' });
            },
          },
          {
            label: 'Sovereign Allocation Model (.xlsx)',
            onApply: () => {
              setTab('SPREADSHEET');
              setSheetTitle('Sovereign Paycheck & Allocation Model');
              setSheetPrompt('Track digital edition revenue, platform fees, fixed obligations, reserves, and monthly net margin');
              pushToast({ title: 'Loaded Excel model preset', tone: 'info' });
            },
          },
          {
            label: 'Quiet Momentum 30-Day Planner',
            onApply: () => {
              setTab('PLANNER');
              setPlannerTitle('Thirty Days of Quiet Momentum');
              setPlannerTheme('Protected morning deep work, intentional spending, and daily execution discipline');
              setDurationDays(30);
              pushToast({ title: 'Loaded 30-Day Planner preset', tone: 'info' });
            },
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              type="button"
              variant={tab === t.id ? 'primary' : 'secondary'}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Button>
          );
        })}
      </div>

      <Card className="space-y-4">
        <IdeaSparkWidget
          category={tab}
          heading="No product idea yet? Let AI suggest a sellable topic for you"
          onApplyIdea={(fields) => {
            if (tab === 'EBOOK') {
              if (fields.title) setEbookTitle(fields.title);
              if (fields.topic) setEbookTopic(fields.topic);
              if (fields.audience) setEbookAudience(fields.audience);
            } else if (tab === 'SPREADSHEET') {
              if (fields.title) setSheetTitle(fields.title);
              if (fields.prompt) setSheetPrompt(fields.prompt);
              if (fields.audience) setSheetAudience(fields.audience);
            } else if (tab === 'PLANNER') {
              if (fields.title) setPlannerTitle(fields.title);
              if (fields.theme) setPlannerTheme(fields.theme);
            } else if (tab === 'JOURNAL') {
              if (fields.title) setJournalTitle(fields.title);
              if (fields.journalType) setJournalType(fields.journalType);
              if (fields.topic) setJournalTopic(fields.topic);
            }
          }}
        />
        {tab === 'EBOOK' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Book Title (Clear Buyer Promise)</Label>
                <Input value={ebookTitle} onChange={(e) => setEbookTitle(e.target.value)} />
              </div>
              <div>
                <Label>Who Is This Book For?</Label>
                <Input value={ebookAudience} onChange={(e) => setEbookAudience(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>What Will Readers Learn?</Label>
              <Textarea rows={2} value={ebookTopic} onChange={(e) => setEbookTopic(e.target.value)} />
            </div>

            <AdvancedOptionsToggle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Illustrations Mode</Label>
                  <Select
                    value={illustrationMode}
                    onChange={(e) => setIllustrationMode(e.target.value as 'FLAT_SVG' | 'PLACEHOLDER_PROMPTS')}
                  >
                    <option value="FLAT_SVG">Built-In Flat SVG Vector Graphics</option>
                    <option value="PLACEHOLDER_PROMPTS">Illustration Prompt Placeholders (For Flow)</option>
                  </Select>
                </div>
                <div>
                  <Label>Chapters (3–8)</Label>
                  <Input
                    type="number"
                    min={3}
                    max={8}
                    value={chapterCount}
                    onChange={(e) => setChapterCount(Math.min(8, Math.max(3, Number(e.target.value) || 4)))}
                  />
                </div>
                <div>
                  <Label>Author Name</Label>
                  <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
                </div>
                <div>
                  <Label>Writing Style</Label>
                  <Input value={writingStyle} onChange={(e) => setWritingStyle(e.target.value)} />
                </div>
                <div>
                  <Label>Brand Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={ebookColor} onChange={(e) => setEbookColor(e.target.value)} className="h-9 w-12 rounded border" />
                    <Input value={ebookColor} onChange={(e) => setEbookColor(e.target.value)} />
                  </div>
                </div>
              </div>
            </AdvancedOptionsToggle>
          </div>
        )}

        {tab === 'SPREADSHEET' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Spreadsheet Title</Label>
                <Input value={sheetTitle} onChange={(e) => setSheetTitle(e.target.value)} />
              </div>
              <div>
                <Label>Who Is It For?</Label>
                <Input value={sheetAudience} onChange={(e) => setSheetAudience(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>What Should This Sheet Track?</Label>
              <Textarea rows={2} value={sheetPrompt} onChange={(e) => setSheetPrompt(e.target.value)} />
            </div>
            <AdvancedOptionsToggle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Complexity</Label>
                  <Select value={sheetComplexity} onChange={(e) => setSheetComplexity(e.target.value as typeof sheetComplexity)}>
                    <option value="SIMPLE">Simple</option>
                    <option value="STANDARD">Standard (Dashboard + Formulas)</option>
                    <option value="ADVANCED">Advanced Multi-Category</option>
                  </Select>
                </div>
                <div>
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={sheetColor} onChange={(e) => setSheetColor(e.target.value)} className="h-9 w-12 rounded border" />
                    <Input value={sheetColor} onChange={(e) => setSheetColor(e.target.value)} />
                  </div>
                </div>
              </div>
            </AdvancedOptionsToggle>
          </div>
        )}

        {tab === 'PLANNER' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Planner Title</Label>
                <Input value={plannerTitle} onChange={(e) => setPlannerTitle(e.target.value)} />
              </div>
              <div>
                <Label>Length</Label>
                <Select
                  value={String(durationDays)}
                  onChange={(e) => setDurationDays(Number(e.target.value) === 365 ? 365 : 30)}
                >
                  <option value="30">30-Day Fast Build PDF</option>
                  <option value="365">365-Day Full-Year Hyperlinked PDF</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Planner Theme</Label>
              <Input value={plannerTheme} onChange={(e) => setPlannerTheme(e.target.value)} />
            </div>
            <AdvancedOptionsToggle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Layout Style</Label>
                  <Input value={layoutStyle} onChange={(e) => setLayoutStyle(e.target.value)} />
                </div>
                <div>
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={plannerColor} onChange={(e) => setPlannerColor(e.target.value)} className="h-9 w-12 rounded border" />
                    <Input value={plannerColor} onChange={(e) => setPlannerColor(e.target.value)} />
                  </div>
                </div>
              </div>
            </AdvancedOptionsToggle>
          </div>
        )}

        {tab === 'JOURNAL' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Workbook / Journal Title</Label>
                <Input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} />
              </div>
              <div>
                <Label>Workbook Type</Label>
                <Input value={journalType} onChange={(e) => setJournalType(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Core Focus</Label>
              <Textarea rows={2} value={journalTopic} onChange={(e) => setJournalTopic(e.target.value)} />
            </div>
            <AdvancedOptionsToggle>
              <div>
                <Label>Brand Color</Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input type="color" value={journalColor} onChange={(e) => setJournalColor(e.target.value)} className="h-9 w-12 rounded border" />
                  <Input value={journalColor} onChange={(e) => setJournalColor(e.target.value)} />
                </div>
              </div>
            </AdvancedOptionsToggle>
          </div>
        )}

        <Button onClick={() => generateProduct()} disabled={loading} data-testid="generate-product-btn">
          <Sparkles className="h-4 w-4" />
          {loading ? 'Creating & Rendering File...' : `Create ${tab === 'SPREADSHEET' ? 'Excel Workbook (.XLSX)' : 'PDF Product'}`}
        </Button>
      </Card>

      {pausedQuota && (
        <PackResultViewer
          title={ebookTitle}
          files={[]}
          pausedQuota={pausedQuota}
          onRetryResume={() => generateProduct(pausedQuota.jobId)}
        />
      )}

      {artifact && (
        <div className="space-y-4">
          <Card className="space-y-5" data-testid="product-artifact-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{artifact.fileName}</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Size: {Math.round(artifact.bytes / 1024)} KB • {artifact.pdfEngine || 'ExcelJS Formula Workbook'} •{' '}
                  {artifact.providerSummary || 'Local'}
                </p>
              </div>
              <a href={`/api/projects/${artifact.projectId}/download`} download data-testid="download-product-link">
                <Button>
                  <Download className="h-4 w-4" /> Download {artifact.kind === 'SPREADSHEET' ? '.XLSX' : '.PDF'}
                </Button>
              </a>
            </div>

            {artifact.previewChapters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {artifact.previewChapters.map((c) => (
                  <div key={c.number} className="rounded-xl border bg-[var(--bg-elevated)] p-3 text-xs space-y-1">
                    <div className="font-semibold text-[var(--accent-text)]">
                      Chapter {c.number}: {c.title}
                    </div>
                    <p className="text-[var(--text-secondary)]">
                      <strong>Author Margin Note:</strong> {c.personalStoryTip}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {artifact.spreadsheetPreview && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                    <div className="text-xs text-[var(--text-secondary)]">Total Income</div>
                    <div className="font-display text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                      ${artifact.spreadsheetPreview.totalIncome.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                    <div className="text-xs text-[var(--text-secondary)]">Total Expenses</div>
                    <div className="font-display text-2xl font-semibold text-rose-600 dark:text-rose-400">
                      ${artifact.spreadsheetPreview.totalExpense.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                    <div className="text-xs text-[var(--text-secondary)]">Net Balance</div>
                    <div className="font-display text-2xl font-semibold text-[var(--accent-text)]">
                      ${artifact.spreadsheetPreview.netBalance.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-64 rounded-xl border bg-[var(--bg-elevated)] p-3">
                    <div className="text-xs font-semibold mb-2">Category Breakdown (Bar)</div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart data={artifact.spreadsheetPreview.chartSummary}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,152,140,0.22)" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64 rounded-xl border bg-[var(--bg-elevated)] p-3">
                    <div className="text-xs font-bold mb-2">Category Share (Pie)</div>
                    <ResponsiveContainer width="100%" height="88%">
                      <PieChart>
                        <Pie
                          data={artifact.spreadsheetPreview.chartSummary}
                          dataKey="total"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={72}
                          label
                        >
                          {artifact.spreadsheetPreview.chartSummary.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <NextStepCard
            title={`Write the Store Page & 10 Video Ideas for "${activeTitle}"`}
            description="Your product file is ready! Next, generate your Payhip/Selar sales copy, pricing ladder, and promo video scripts."
            href={`/products/funnel?productId=${encodeURIComponent(artifact.projectId)}&title=${encodeURIComponent(activeTitle)}`}
            cta="Write Store Page & Promo Plan"
          />
        </div>
      )}
    </div>
  );
}
