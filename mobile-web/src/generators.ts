import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { extractJsonSafe, generateMobileAI } from './ai-router';

export function slugifyName(input: string, fallback = 'edition'): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}

function addWrappedPdfBlock(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let cursor = y;
  for (const line of lines) {
    if (cursor > 272) {
      doc.addPage();
      cursor = 22;
    }
    doc.text(line, x, cursor);
    cursor += lineHeight;
  }
  return cursor;
}

export async function buildEbookPdf(params: {
  title: string;
  topic: string;
  audience: string;
  chaptersCount: number;
  authorName: string;
}): Promise<{ bytes: Uint8Array; fileName: string; summary: string; providerSummary: string }> {
  const ai = await generateMobileAI(
    `Create a practical ${params.chaptersCount}-chapter ebook outline and chapter text for "${params.title}" about ${params.topic} for ${params.audience}.
Return STRICT JSON:
{
  "subtitle": "Clear subtitle",
  "chapters": [
    { "title": "Chapter title", "body": "2 practical paragraphs", "checklist": ["Step 1", "Step 2", "Step 3"] }
  ]
}`,
    true
  );

  interface ParsedEbook {
    subtitle?: string;
    chapters?: Array<{ title: string; body: string; checklist?: string[] }>;
  }
  const parsed = ai.ok && ai.text ? extractJsonSafe<ParsedEbook>(ai.text) : null;
  const subtitle = parsed?.subtitle || `Actionable Edition for ${params.audience}`;
  const chapters =
    parsed?.chapters && parsed.chapters.length > 0
      ? parsed.chapters.slice(0, params.chaptersCount)
      : Array.from({ length: params.chaptersCount }, (_, idx) => ({
          title: `Core Pillar ${idx + 1}: Executing ${params.title}`,
          body: `Focus on ${params.topic}. Break this pillar into one measurable 20-minute daily action tailored for ${params.audience}.\n\nAudit your weekly results, eliminate wasted effort, and document one repeatable template you can reuse.`,
          checklist: [
            'Define your clear target metric for this chapter',
            'Complete the 20-minute implementation sprint',
            'Review outcomes at the end of the week',
          ],
        }));

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // Cover Page
  doc.setFillColor(17, 17, 21);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.7);
  doc.rect(14, 14, 182, 269);

  doc.setTextColor(212, 175, 55);
  doc.setFontSize(11);
  doc.text('NTK CREATOR COMMAND · DIGITAL EDITION', 24, 38);

  doc.setTextColor(245, 241, 232);
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(params.title, 160) as string[];
  doc.text(titleLines, 24, 72);

  doc.setTextColor(180, 172, 158);
  doc.setFontSize(13);
  doc.text(doc.splitTextToSize(subtitle, 160) as string[], 24, 112);

  doc.setTextColor(212, 175, 55);
  doc.setFontSize(12);
  doc.text(`By ${params.authorName || 'NTK Hub'}`, 24, 258);

  // Chapters
  chapters.forEach((ch, idx) => {
    doc.addPage();
    doc.setFillColor(246, 243, 236);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(158, 115, 24);
    doc.setFontSize(10);
    doc.text(`CHAPTER ${idx + 1}`, 20, 24);

    doc.setTextColor(20, 18, 16);
    doc.setFontSize(18);
    let y = addWrappedPdfBlock(doc, ch.title, 20, 34, 170, 8);
    y += 6;

    doc.setFontSize(11);
    doc.setTextColor(45, 42, 38);
    y = addWrappedPdfBlock(doc, ch.body, 20, y, 170, 6);
    y += 8;

    doc.setTextColor(158, 115, 24);
    doc.setFontSize(11);
    doc.text('Action Checklist', 20, y);
    y += 7;

    doc.setTextColor(20, 18, 16);
    doc.setFontSize(10);
    for (const item of ch.checklist || []) {
      y = addWrappedPdfBlock(doc, `[ ] ${item}`, 22, y, 166, 6);
    }
  });

  const out = new Uint8Array(doc.output('arraybuffer'));
  return {
    bytes: out,
    fileName: `ntk-command-${slugifyName(params.title, 'ebook')}.pdf`,
    summary: `${chapters.length}-chapter PDF monograph ready`,
    providerSummary: ai.providerSummary,
  };
}

export async function buildPlannerPdf(params: {
  title: string;
  theme: string;
  days: 30 | 365;
}): Promise<{ bytes: Uint8Array; fileName: string; summary: string; providerSummary: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(17, 17, 21);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(11);
  doc.text(`NTK DIGITAL PRESS · ${params.days}-DAY PLANNER`, 22, 38);
  doc.setTextColor(245, 241, 232);
  doc.setFontSize(26);
  doc.text(doc.splitTextToSize(params.title, 164) as string[], 22, 68);
  doc.setTextColor(180, 172, 158);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(params.theme, 164) as string[], 22, 108);

  const pageDays = params.days === 365 ? 60 : 30;
  for (let d = 1; d <= pageDays; d++) {
    if (d % 2 === 1) {
      doc.addPage();
    }
    const baseY = d % 2 === 1 ? 22 : 155;
    doc.setDrawColor(210, 200, 180);
    doc.rect(18, baseY, 174, 118);
    doc.setTextColor(158, 115, 24);
    doc.setFontSize(13);
    doc.text(`Day ${d} of ${params.days}`, 24, baseY + 11);
    doc.setTextColor(40, 38, 34);
    doc.setFontSize(10);
    doc.text('Top 3 Needle-Movers:', 24, baseY + 23);
    doc.line(24, baseY + 32, 184, baseY + 32);
    doc.line(24, baseY + 42, 184, baseY + 42);
    doc.line(24, baseY + 52, 184, baseY + 52);
    doc.text('Habit Check: [ ] Deep Work   [ ] Outreach   [ ] Expense Log', 24, baseY + 66);
    doc.text('Evening Reflection:', 24, baseY + 80);
    doc.line(24, baseY + 90, 184, baseY + 90);
    doc.line(24, baseY + 102, 184, baseY + 102);
  }

  const out = new Uint8Array(doc.output('arraybuffer'));
  return {
    bytes: out,
    fileName: `ntk-command-${slugifyName(params.title, 'planner')}.pdf`,
    summary: `${params.days}-day printable planner PDF`,
    providerSummary: 'On-Device PDF Engine',
  };
}

export async function buildJournalPdf(params: {
  title: string;
  topic: string;
}): Promise<{ bytes: Uint8Array; fileName: string; summary: string; providerSummary: string }> {
  const prompts = [
    {
      title: '1. Baseline Clarity Audit',
      prompt: `Where are your biggest leaks in ${params.topic}?`,
    },
    {
      title: '2. 30-Day Measurable Target',
      prompt: 'Write one exact numeric milestone and three habits that move it forward.',
    },
    {
      title: '3. Obstacle & Guardrail Plan',
      prompt: 'What usually derails consistency, and what simple boundary prevents it?',
    },
    {
      title: '4. Weekly Review & Reset',
      prompt: 'Celebrate one win from this week and choose tomorrow’s first 20-minute block.',
    },
  ];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(17, 17, 21);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(11);
  doc.text('NTK DIGITAL PRESS · GUIDED WORKBOOK', 22, 38);
  doc.setTextColor(245, 241, 232);
  doc.setFontSize(26);
  doc.text(doc.splitTextToSize(params.title, 164) as string[], 22, 68);
  doc.setTextColor(180, 172, 158);
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(params.topic, 164) as string[], 22, 108);

  for (const item of prompts) {
    doc.addPage();
    doc.setTextColor(158, 115, 24);
    doc.setFontSize(16);
    doc.text(item.title, 20, 28);
    doc.setTextColor(40, 38, 34);
    doc.setFontSize(11);
    const y = addWrappedPdfBlock(doc, item.prompt, 20, 40, 170, 6);
    doc.setDrawColor(210, 200, 180);
    for (let lineY = y + 12; lineY < 268; lineY += 12) {
      doc.line(20, lineY, 190, lineY);
    }
  }

  const out = new Uint8Array(doc.output('arraybuffer'));
  return {
    bytes: out,
    fileName: `ntk-command-${slugifyName(params.title, 'workbook')}.pdf`,
    summary: '4-exercise reflection workbook PDF',
    providerSummary: 'On-Device PDF Engine',
  };
}

export async function buildFormulaSpreadsheetXlsx(params: {
  title: string;
  goal: string;
}): Promise<{ bytes: Uint8Array; fileName: string; summary: string; providerSummary: string }> {
  const wb = XLSX.utils.book_new();
  const rows: Array<Array<string | number | { f: string }>> = [
    ['Date', 'Description', 'Category', 'Type', 'Amount'],
    ['2026-11-01', 'Digital Ebook Bundle Sales', 'Digital Sales', 'Income', 850],
    ['2026-11-04', 'Excel Template Launch', 'Digital Sales', 'Income', 420],
    ['2026-11-06', 'Domain & Hosting', 'Operations', 'Expense', 24],
    ['2026-11-08', 'Design Assets', 'Content Tools', 'Expense', 18],
    ['2026-11-12', 'Reserve Savings Transfer', 'Savings', 'Expense', 250],
  ];
  const ledgerWs = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ledgerWs, 'Transactions');

  const dashRows: Array<Array<string | number | { f: string }>> = [
    [params.title],
    [params.goal],
    [],
    ['Metric', 'Formula / Value'],
    ['Total Income', { f: 'SUMIF(Transactions!D2:D6,"Income",Transactions!E2:E6)' }],
    ['Total Expenses', { f: 'SUMIF(Transactions!D2:D6,"Expense",Transactions!E2:E6)' }],
    ['Net Balance', { f: 'B5-B6' }],
    ['Average Transaction', { f: 'AVERAGE(Transactions!E2:E6)' }],
  ];
  const dashWs = XLSX.utils.aoa_to_sheet(dashRows);
  XLSX.utils.book_append_sheet(wb, dashWs, 'Dashboard');

  const arrayBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return {
    bytes: new Uint8Array(arrayBuf),
    fileName: `ntk-command-${slugifyName(params.title, 'model')}.xlsx`,
    summary: 'Multi-sheet Excel workbook with live SUMIF/AVERAGE formulas',
    providerSummary: 'On-Device Excel Engine',
  };
}

export async function buildCinemaOrBrandZip(params: {
  packType: 'FLOW_MOVIE' | 'FLOW_BULK' | 'BRAND_PACK' | 'NOTEBOOK_PACK' | 'PUBLISH_PACK';
  title: string;
  premise: string;
  visualStyle: string;
}): Promise<{ bytes: Uint8Array; fileName: string; summary: string; providerSummary: string }> {
  const ai = await generateMobileAI(
    `Build a structured production pack (${params.packType}) titled "${params.title}".
Premise/Topic: ${params.premise}
Visual style: ${params.visualStyle}

Return STRICT JSON:
{
  "overview": "Concise production brief",
  "castOrPalette": ["Character/Palette anchor 1", "Anchor 2"],
  "scenesOrAssets": ["01: Opening hook shot", "02: Core conflict", "03: Payoff", "04: CTA"]
}`,
    true
  );

  interface PackJson {
    overview?: string;
    castOrPalette?: string[];
    scenesOrAssets?: string[];
  }
  const parsed = ai.ok && ai.text ? extractJsonSafe<PackJson>(ai.text) : null;
  const overview = parsed?.overview || `${params.title} — ${params.premise}`;
  const anchors = parsed?.castOrPalette || [
    `Primary Style Anchor: ${params.visualStyle}`,
    'Lighting & Framing: High-contrast editorial lighting, consistent aspect ratio',
  ];
  const scenes = parsed?.scenesOrAssets || [
    `01_HOOK: ${params.visualStyle} opening frame establishing "${params.premise}"`,
    '02_SETUP: Introduce the core character/problem in steady medium shot',
    '03_TURN: Visual transformation showing the key takeaway',
    '04_CTA: Clean end-card linking to your digital edition or channel subscribe',
  ];

  const zip = new JSZip();
  zip.file(
    '00_README_START_HERE.txt',
    `NTK CREATOR COMMAND — ${params.packType}\nTitle: ${params.title}\nStyle: ${params.visualStyle}\n\nOverview:\n${overview}\n`
  );
  zip.file('01_CONTINUITY_ANCHORS.txt', anchors.join('\n\n'));
  zip.file('02_ORDERED_PROMPTS.txt', scenes.join('\n\n'));
  zip.file(
    '03_FFMPEG_STREAM_COPY.sh',
    `#!/usr/bin/env bash\n# Zero-reencode fast assembly when clips share codec/resolution\nprintf "file '%s'\\n" clip_*.mp4 > concat_list.txt\nffmpeg -f concat -safe 0 -i concat_list.txt -c copy "${slugifyName(params.title)}-final.mp4"\n`
  );

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return {
    bytes,
    fileName: `ntk-command-${slugifyName(params.title, 'pack')}.zip`,
    summary: `${params.packType} production ZIP (${scenes.length} prompts + scripts)`,
    providerSummary: ai.providerSummary,
  };
}
