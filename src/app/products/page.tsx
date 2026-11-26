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
import { useToast } from '@/components/ToastProvider';

type StudioTab = 'EBOOK' | 'SPREADSHEET' | 'PLANNER' | 'JOURNAL';

const CHART_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

export default function DigitalProductsStudioPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<StudioTab>('EBOOK');
  const [loading, setLoading] = useState(false);

  // Ebook 8-input form
  const [ebookTitle, setEbookTitle] = useState('The 30-Day Cashflow & Side-Income Reset');
  const [ebookTopic, setEbookTopic] = useState('Practical budgeting, cutting hidden expenses, and launching a $15 digital product');
  const [illustrationMode, setIllustrationMode] = useState<'FLAT_SVG' | 'PLACEHOLDER_PROMPTS'>('FLAT_SVG');
  const [chapterCount, setChapterCount] = useState(4);
  const [ebookColor, setEbookColor] = useState('#4F46E5');
  const [authorName, setAuthorName] = useState('NTK Hub');
  const [writingStyle, setWritingStyle] = useState('Direct, actionable, encouraging');
  const [ebookAudience, setEbookAudience] = useState('Beginners & side-hustle builders');

  // Spreadsheet form
  const [sheetTitle, setSheetTitle] = useState('Creator Monthly Cashflow & Product Revenue Tracker');
  const [sheetPrompt, setSheetPrompt] = useState('Track digital product sales, ad/tool expenses, savings transfers, and monthly net balance');
  const [sheetAudience, setSheetAudience] = useState('Solo digital creators');
  const [sheetComplexity, setSheetComplexity] = useState<'SIMPLE' | 'STANDARD' | 'ADVANCED'>('STANDARD');
  const [sheetColor, setSheetColor] = useState('#4F46E5');

  // Planner form
  const [plannerTitle, setPlannerTitle] = useState('Creator Focus & Habit Command Planner');
  const [plannerTheme, setPlannerTheme] = useState('Daily deep work, content velocity, and zero-impulse spending');
  const [durationDays, setDurationDays] = useState<30 | 365>(30);
  const [layoutStyle, setLayoutStyle] = useState('Minimalist Grid');
  const [plannerColor, setPlannerColor] = useState('#4F46E5');

  // Journal form
  const [journalTitle, setJournalTitle] = useState('Mindful Spending & Financial Clarity Workbook');
  const [journalType, setJournalType] = useState('Budgeting & Reflection Workbook');
  const [journalTopic, setJournalTopic] = useState('Weekly spending audits, trigger awareness, and 90-day debt/savings goals');
  const [journalColor, setJournalColor] = useState('#4F46E5');

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Digital Product Studio"
        subtitle="Compile commercial-grade PDFs and formula-powered Excel workbooks locally at $0 cost—ready to sell on Payhip, Selar, Gumroad, or Shopify."
        badge="$0 Local Engine"
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
        {tab === 'EBOOK' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Book Title (Clear Buyer Promise)</Label>
              <Input value={ebookTitle} onChange={(e) => setEbookTitle(e.target.value)} />
            </div>
            <div>
              <Label>Target Audience</Label>
              <Input value={ebookAudience} onChange={(e) => setEbookAudience(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Topic & Core Outcome</Label>
              <Textarea rows={2} value={ebookTopic} onChange={(e) => setEbookTopic(e.target.value)} />
            </div>
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
        )}

        {tab === 'SPREADSHEET' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Spreadsheet Title</Label>
              <Input value={sheetTitle} onChange={(e) => setSheetTitle(e.target.value)} />
            </div>
            <div>
              <Label>Target Audience</Label>
              <Input value={sheetAudience} onChange={(e) => setSheetAudience(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Spreadsheet Purpose & Columns</Label>
              <Textarea rows={2} value={sheetPrompt} onChange={(e) => setSheetPrompt(e.target.value)} />
            </div>
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
        )}

        {tab === 'PLANNER' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Planner Title</Label>
              <Input value={plannerTitle} onChange={(e) => setPlannerTitle(e.target.value)} />
            </div>
            <div>
              <Label>Duration</Label>
              <Select
                value={String(durationDays)}
                onChange={(e) => setDurationDays(Number(e.target.value) === 365 ? 365 : 30)}
              >
                <option value="30">30-Day Fast Build PDF</option>
                <option value="365">365-Day Full-Year Hyperlinked PDF</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Planner Theme</Label>
              <Input value={plannerTheme} onChange={(e) => setPlannerTheme(e.target.value)} />
            </div>
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
        )}

        {tab === 'JOURNAL' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Workbook / Journal Title</Label>
              <Input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} />
            </div>
            <div>
              <Label>Workbook Type</Label>
              <Input value={journalType} onChange={(e) => setJournalType(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Core Focus</Label>
              <Textarea rows={2} value={journalTopic} onChange={(e) => setJournalTopic(e.target.value)} />
            </div>
            <div>
              <Label>Brand Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={journalColor} onChange={(e) => setJournalColor(e.target.value)} className="h-9 w-12 rounded border" />
                <Input value={journalColor} onChange={(e) => setJournalColor(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <Button onClick={() => generateProduct()} disabled={loading} data-testid="generate-product-btn">
          <Sparkles className="h-4 w-4" />
          {loading ? 'Generating & Rendering Artifact...' : `Generate ${tab === 'SPREADSHEET' ? '.XLSX Workbook' : '.PDF Product'}`}
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
                  <div className="font-bold text-indigo-400">
                    Chapter {c.number}: {c.title}
                  </div>
                  <p className="text-[var(--text-secondary)]">
                    <strong>Personal Story Prompt:</strong> {c.personalStoryTip}
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
                  <div className="text-lg font-bold text-emerald-400">${artifact.spreadsheetPreview.totalIncome.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                  <div className="text-xs text-[var(--text-secondary)]">Total Expenses</div>
                  <div className="text-lg font-bold text-rose-400">${artifact.spreadsheetPreview.totalExpense.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                  <div className="text-xs text-[var(--text-secondary)]">Net Balance</div>
                  <div className="text-lg font-bold text-indigo-400">${artifact.spreadsheetPreview.netBalance.toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-64 rounded-xl border bg-[var(--bg-elevated)] p-3">
                  <div className="text-xs font-bold mb-2">Category Breakdown (Bar)</div>
                  <ResponsiveContainer width="100%" height="88%">
                    <BarChart data={artifact.spreadsheetPreview.chartSummary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#6366F1" radius={[6, 6, 0, 0]} />
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
      )}
    </div>
  );
}
