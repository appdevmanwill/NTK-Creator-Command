import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runCheckpointedJob } from '@/lib/ai-router/checkpoint';
import { generateWithRouter } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { saveSingleProductArtifact } from '@/lib/packs/zip-compiler';
import {
  buildEbookDocumentHtml,
  buildJournalWorkbookHtml,
  buildPlannerDocumentHtml,
  EbookChapter,
} from '@/lib/products/ebook-planner-html';
import { renderHtmlToPdfBuffer } from '@/lib/products/pdf-renderer';
import { buildFormulaExcelWorkbook, SpreadsheetSpec } from '@/lib/products/spreadsheet-generator';
import { extractJsonFromText, slugify } from '@/lib/utils';

const EbookInput = z.object({
  kind: z.literal('EBOOK'),
  existingJobId: z.string().optional(),
  title: z.string().min(1),
  topic: z.string().min(1),
  illustrationMode: z.enum(['FLAT_SVG', 'PLACEHOLDER_PROMPTS']).default('FLAT_SVG'),
  chapterCount: z.number().int().min(3).max(8).default(4),
  brandColor: z.string().default('#4F46E5'),
  authorName: z.string().default('NTK Hub'),
  writingStyle: z.string().default('Practical, actionable, clear'),
  audience: z.string().default('Creators & digital entrepreneurs'),
});

const SpreadsheetInput = z.object({
  kind: z.literal('SPREADSHEET'),
  title: z.string().min(1),
  prompt: z.string().min(1),
  audience: z.string().default('Solo creators & households'),
  complexity: z.enum(['SIMPLE', 'STANDARD', 'ADVANCED']).default('STANDARD'),
  brandColor: z.string().default('#4F46E5'),
});

const PlannerInput = z.object({
  kind: z.literal('PLANNER'),
  title: z.string().min(1),
  theme: z.string().min(1),
  durationDays: z.union([z.literal(30), z.literal(365)]).default(30),
  layoutStyle: z.string().default('Minimalist Command'),
  brandColor: z.string().default('#4F46E5'),
});

const JournalInput = z.object({
  kind: z.literal('JOURNAL'),
  title: z.string().min(1),
  journalType: z.string().default('Spending & Reflection Workbook'),
  topic: z.string().min(1),
  brandColor: z.string().default('#4F46E5'),
});

const GenerateProductSchema = z.discriminatedUnion('kind', [
  EbookInput,
  SpreadsheetInput,
  PlannerInput,
  JournalInput,
]);

interface EbookJobState extends Record<string, unknown> {
  subtitle?: string;
  chapterTitles?: string[];
  chapters?: EbookChapter[];
  conclusion?: string;
  _lastProviderUsed?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = GenerateProductSchema.parse(await req.json());

    if (body.kind === 'EBOOK') {
      const outlineStep = {
        name: 'Generate Ebook Subtitle & Chapter Outline',
        run: async (st: EbookJobState, ctx: { jobId: string }) => {
          const res = await generateWithRouter({
            taskType: 'fast_generation',
            prompt: `Create an ebook outline for "${body.title}".
Topic: ${body.topic}
Audience: ${body.audience}
Style: ${body.writingStyle}
Exact number of chapters: ${body.chapterCount}

Return STRICT JSON:
{
  "subtitle": "Clear benefit-driven subtitle",
  "chapterTitles": ["Chapter 1 title", "..."],
  "conclusion": "2-paragraph actionable conclusion"
}`,
            jsonMode: true,
            maxOutputTokens: 2048,
            jobId: ctx.jobId,
          });
          const parsed = extractJsonFromText<{
            subtitle: string;
            chapterTitles: string[];
            conclusion: string;
          }>(res.text);
          return {
            ...st,
            subtitle: parsed.subtitle,
            chapterTitles: parsed.chapterTitles.slice(0, body.chapterCount),
            conclusion: parsed.conclusion,
            _lastProviderUsed: `${res.provider}/${res.model}`,
          };
        },
      };

      const chapterIndices = Array.from({ length: body.chapterCount }, (_, i) => i);
      const chapterSteps = chapterIndices.map((idx) => ({
        name: `Write Chapter ${idx + 1} of ${body.chapterCount}`,
        run: async (st: EbookJobState, ctx: { jobId: string }) => {
          const chTitle = st.chapterTitles?.[idx] || `Core Pillar ${idx + 1}`;
          const res = await generateWithRouter({
            taskType: 'fast_generation',
            prompt: `Write Chapter ${idx + 1} titled "${chTitle}" for the ebook "${body.title}" (${body.topic}).
Audience: ${body.audience}
Style: ${body.writingStyle}

Return STRICT JSON:
{
  "paragraphs": ["Paragraph 1 (practical, specific)", "Paragraph 2 (step-by-step example)", "Paragraph 3 (common mistake to avoid)"],
  "personalStoryTip": "A prompt/example box inviting the author to insert their real personal win or lesson",
  "checklist": ["Action step 1", "Action step 2", "Action step 3"],
  "illustrationPrompt": "Concise 1-sentence flat illustration description for this chapter"
}`,
            jsonMode: true,
            maxOutputTokens: 3072,
            jobId: ctx.jobId,
          });
          const parsed = extractJsonFromText<{
            paragraphs?: string[];
            personalStoryTip?: string;
            checklist?: string[];
            illustrationPrompt?: string;
          }>(res.text);
          const paragraphs = Array.isArray(parsed.paragraphs) && parsed.paragraphs.length
            ? parsed.paragraphs
            : ['Apply the core workflow step by step and measure your weekly results.'];
          const bodyHtml = paragraphs.map((p) => `<p>${String(p)}</p>`).join('');
          const prev = st.chapters ?? [];
          return {
            ...st,
            chapters: [
              ...prev,
              {
                number: idx + 1,
                title: chTitle,
                bodyHtml,
                personalStoryTip:
                  parsed.personalStoryTip ||
                  'Add a quick real-world example or personal win from applying this step.',
                checklist: Array.isArray(parsed.checklist) && parsed.checklist.length
                  ? parsed.checklist.map(String)
                  : ['Review chapter notes', 'Complete the main exercise', 'Track outcome'],
                illustrationPrompt: parsed.illustrationPrompt || `Flat geometric diagram illustrating ${chTitle}`,
              },
            ],
            _lastProviderUsed: `${res.provider}/${res.model}`,
          };
        },
      }));

      const runResult = await runCheckpointedJob<EbookJobState>({
        existingJobId: body.existingJobId,
        moduleType: 'EBOOK',
        title: body.title,
        initialState: { chapters: [] },
        steps: [outlineStep, ...chapterSteps],
      });

      if (runResult.status === 'PAUSED_QUOTA') {
        return NextResponse.json(runResult, { status: 429 });
      }
      if (runResult.status === 'FAILED') {
        return NextResponse.json({ error: runResult.error }, { status: 500 });
      }

      const { html, fallbackSections } = buildEbookDocumentHtml({
        title: body.title,
        subtitle: runResult.state.subtitle || body.topic,
        authorName: body.authorName,
        brandColor: body.brandColor,
        illustrationMode: body.illustrationMode,
        chapters: runResult.state.chapters ?? [],
        conclusion: runResult.state.conclusion || 'Apply one checklist today and track measurable progress.',
      });

      const pdf = await renderHtmlToPdfBuffer(html, fallbackSections);
      const fileName = `ntk-command-${slugify(body.title, 'ebook')}.pdf`;
      const saved = await saveSingleProductArtifact({
        type: 'EBOOK',
        title: body.title,
        fileName,
        buffer: pdf.buffer,
        metadata: {
          pdfEngine: pdf.engine,
          chapterCount: body.chapterCount,
          provider: runResult.lastProviderUsed,
          chapters: runResult.state.chapters,
        },
      });

      return NextResponse.json({
        projectId: saved.project.id,
        fileName: saved.fileName,
        bytes: saved.bytes,
        pdfEngine: pdf.engine,
        providerSummary: runResult.lastProviderUsed,
        previewChapters: runResult.state.chapters,
      });
    }

    if (body.kind === 'SPREADSHEET') {
      let spec: SpreadsheetSpec;
      let providerSummary = 'Deterministic Fallback';

      try {
        const res = await generateWithRouter({
          taskType: 'fast_generation',
          prompt: `Design a practical ${body.complexity} digital spreadsheet dataset for "${body.title}".
Goal: ${body.prompt}
Audience: ${body.audience}

Return STRICT JSON:
{
  "currencySymbol": "$",
  "categories": ["Category 1", "Category 2", "Category 3", "Category 4", "Category 5"],
  "rows": [
    { "date": "2026-11-01", "description": "Sample item", "category": "Category 1", "type": "Income", "amount": 1200 },
    { "date": "2026-11-02", "description": "Sample expense", "category": "Category 2", "type": "Expense", "amount": 180 }
  ]
}
Include 10-14 realistic sample rows using ONLY the categories in "categories", with mix of Income and Expense.`,
          jsonMode: true,
          maxOutputTokens: 3072,
        });
        const parsed = extractJsonFromText<{
          currencySymbol?: string;
          categories: string[];
          rows: SpreadsheetSpec['rows'];
        }>(res.text);
        spec = {
          title: body.title,
          brandColor: body.brandColor,
          currencySymbol: parsed.currencySymbol || '$',
          categories: parsed.categories.slice(0, 6),
          rows: parsed.rows,
        };
        providerSummary = `${res.provider}/${res.model}`;
      } catch (err) {
        if (!(err instanceof AllKeysExhaustedError)) throw err;
        spec = {
          title: body.title,
          brandColor: body.brandColor,
          currencySymbol: '$',
          categories: ['Digital Sales', 'Content Tools', 'Marketing', 'Savings', 'Operations'],
          rows: [
            { date: '2026-11-01', description: 'Ebook Bundle Launch', category: 'Digital Sales', type: 'Income', amount: 850 },
            { date: '2026-11-03', description: 'Template Pack Sales', category: 'Digital Sales', type: 'Income', amount: 420 },
            { date: '2026-11-04', description: 'Domain & Email', category: 'Operations', type: 'Expense', amount: 24 },
            { date: '2026-11-06', description: 'Canva / Design Assets', category: 'Content Tools', type: 'Expense', amount: 15 },
            { date: '2026-11-09', description: 'Emergency Reserve Transfer', category: 'Savings', type: 'Expense', amount: 250 },
          ],
        };
      }

      const xlsx = await buildFormulaExcelWorkbook(spec);
      const fileName = `ntk-command-${slugify(body.title, 'tracker')}.xlsx`;
      const saved = await saveSingleProductArtifact({
        type: 'SPREADSHEET',
        title: body.title,
        fileName,
        buffer: xlsx.buffer,
        metadata: {
          chartSummary: xlsx.chartSummary,
          totalIncome: xlsx.totalIncome,
          totalExpense: xlsx.totalExpense,
          netBalance: xlsx.netBalance,
          provider: providerSummary,
        },
      });

      return NextResponse.json({
        projectId: saved.project.id,
        fileName: saved.fileName,
        bytes: saved.bytes,
        providerSummary,
        spreadsheetPreview: {
          chartSummary: xlsx.chartSummary,
          totalIncome: xlsx.totalIncome,
          totalExpense: xlsx.totalExpense,
          netBalance: xlsx.netBalance,
          rows: spec.rows,
        },
      });
    }

    if (body.kind === 'PLANNER') {
      let goals = ['Ship 1 flagship digital product', 'Publish 3 high-retention videos weekly', 'Track daily revenue & savings'];
      let habits = ['Deep Work 60m', 'Hook Ideation', 'Expense Log', 'Zero Impulse Spend'];
      let dailyPrompt = 'What is the single needle-mover today?';
      let providerSummary = 'Deterministic Template';

      try {
        const res = await generateWithRouter({
          taskType: 'fast_generation',
          prompt: `Generate planner content for "${body.title}" (Theme: ${body.theme}, ${body.durationDays}-Day).
Return STRICT JSON: { "goals": ["...", "...", "..."], "habits": ["...", "...", "...", "..."], "dailyPrompt": "..." }`,
          jsonMode: true,
          maxOutputTokens: 1024,
        });
        const parsed = extractJsonFromText<{ goals: string[]; habits: string[]; dailyPrompt: string }>(res.text);
        if (parsed.goals?.length) goals = parsed.goals;
        if (parsed.habits?.length) habits = parsed.habits;
        if (parsed.dailyPrompt) dailyPrompt = parsed.dailyPrompt;
        providerSummary = `${res.provider}/${res.model}`;
      } catch {
        // use defaults
      }

      const { html, fallbackSections } = buildPlannerDocumentHtml({
        title: body.title,
        theme: body.theme,
        durationDays: body.durationDays,
        layoutStyle: body.layoutStyle,
        brandColor: body.brandColor,
        goals,
        habits,
        dailyPrompt,
      });

      const pdf = await renderHtmlToPdfBuffer(html, fallbackSections);
      const fileName = `ntk-command-${slugify(body.title, 'planner')}.pdf`;
      const saved = await saveSingleProductArtifact({
        type: 'PLANNER',
        title: body.title,
        fileName,
        buffer: pdf.buffer,
        metadata: { durationDays: body.durationDays, pdfEngine: pdf.engine, provider: providerSummary },
      });

      return NextResponse.json({
        projectId: saved.project.id,
        fileName: saved.fileName,
        bytes: saved.bytes,
        pdfEngine: pdf.engine,
        providerSummary,
      });
    }

    // JOURNAL
    let prompts = [
      {
        number: 1,
        title: 'Baseline Money & Time Audit',
        guide: 'List your recurring weekly expenses and notice which purchases did not improve your week.',
        reflectionQuestions: ['Which expense brought the highest real joy?', 'What recurring leak can you pause this week?'],
      },
      {
        number: 2,
        title: '90-Day Payoff & Savings Sprint',
        guide: 'Set one concrete target number and identify three small daily swaps that fund it.',
        reflectionQuestions: ['My 90-day target number is:', 'Three realistic swaps I commit to:'],
      },
      {
        number: 3,
        title: 'Weekly Reset & Gratitude Check-In',
        guide: 'Close each Sunday by celebrating wins and setting one boundary for the coming week.',
        reflectionQuestions: ['One financial or creative win this week:', 'One boundary I am setting next week:'],
      },
    ];
    let providerSummary = 'Deterministic Template';

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `Create 4 guided workbook exercises for "${body.title}" (${body.journalType} about ${body.topic}).
Return STRICT JSON: { "prompts": [{ "number": 1, "title": "...", "guide": "...", "reflectionQuestions": ["...", "..."] }] }`,
        jsonMode: true,
        maxOutputTokens: 2048,
      });
      const parsed = extractJsonFromText<{ prompts: typeof prompts }>(res.text);
      if (parsed.prompts?.length) prompts = parsed.prompts;
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      // use defaults
    }

    const { html, fallbackSections } = buildJournalWorkbookHtml({
      title: body.title,
      journalType: body.journalType,
      brandColor: body.brandColor,
      prompts,
    });
    const pdf = await renderHtmlToPdfBuffer(html, fallbackSections);
    const fileName = `ntk-command-${slugify(body.title, 'journal')}.pdf`;
    const saved = await saveSingleProductArtifact({
      type: 'JOURNAL',
      title: body.title,
      fileName,
      buffer: pdf.buffer,
      metadata: { journalType: body.journalType, pdfEngine: pdf.engine, provider: providerSummary },
    });

    return NextResponse.json({
      projectId: saved.project.id,
      fileName: saved.fileName,
      bytes: saved.bytes,
      pdfEngine: pdf.engine,
      providerSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate product' },
      { status: 400 }
    );
  }
}
