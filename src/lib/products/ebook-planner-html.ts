export interface EbookChapter {
  number: number;
  title: string;
  bodyHtml: string;
  personalStoryTip: string;
  checklist: string[];
  illustrationPrompt: string;
}

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function flatSvgIllustration(chapterNumber: number, brandColor: string, caption: string): string {
  const accent = brandColor || '#4F46E5';
  const variant = chapterNumber % 3;
  const shapes =
    variant === 1
      ? `<circle cx="110" cy="70" r="38" fill="${accent}" opacity="0.18"/><rect x="85" y="45" width="50" height="50" rx="12" fill="${accent}"/><path d="M100 70L108 78L122 62" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
      : variant === 2
      ? `<rect x="45" y="30" width="130" height="80" rx="12" fill="${accent}" opacity="0.14"/><rect x="65" y="48" width="24" height="44" rx="4" fill="${accent}" opacity="0.6"/><rect x="98" y="36" width="24" height="56" rx="4" fill="${accent}" opacity="0.85"/><rect x="131" y="24" width="24" height="68" rx="4" fill="${accent}"/>`
      : `<polygon points="110,22 158,108 62,108" fill="${accent}" opacity="0.18"/><circle cx="110" cy="72" r="22" fill="${accent}"/><circle cx="110" cy="72" r="9" fill="#fff"/>`;

  return `
  <div class="svg-card">
    <svg width="220" height="120" viewBox="0 0 220 120" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>
    <div class="svg-caption">${escapeHtml(caption)}</div>
  </div>`;
}

export function buildEbookDocumentHtml(params: {
  title: string;
  subtitle: string;
  authorName: string;
  brandColor: string;
  illustrationMode: 'FLAT_SVG' | 'PLACEHOLDER_PROMPTS';
  chapters: EbookChapter[];
  conclusion: string;
}): {
  html: string;
  fallbackSections: { title: string; subtitle: string; blocks: Array<{ heading: string; body: string }> };
} {
  const color = params.brandColor || '#4F46E5';
  const tocItems = params.chapters
    .map(
      (c) =>
        `<li><a href="#ch-${c.number}"><span>Chapter ${c.number}: ${escapeHtml(c.title)}</span><span>${c.number + 2}</span></a></li>`
    )
    .join('');

  const chapterHtml = params.chapters
    .map((c) => {
      const promptText = c.illustrationPrompt || c.title || 'Chapter visual';
      const visual =
        params.illustrationMode === 'FLAT_SVG'
          ? flatSvgIllustration(c.number, color, promptText)
          : `<div class="placeholder-box"><strong>[Illustration Prompt Placeholder — Paste into Google Flow / Nano Banana]</strong><p>${escapeHtml(promptText)}</p></div>`;
      const checks = (Array.isArray(c.checklist) ? c.checklist : [])
        .map((item) => `<li>&#9744; ${escapeHtml(item)}</li>`)
        .join('');

      return `
      <section class="page-break" id="ch-${c.number}">
        <div class="chapter-kicker">Chapter ${String(c.number).padStart(2, '0')}</div>
        <h2>${escapeHtml(c.title)}</h2>
        ${visual}
        <div class="chapter-body">${c.bodyHtml || '<p>Practical walkthrough and action steps.</p>'}</div>
        <div class="callout">
          <div class="callout-title">Add Your Personal Story / Tip</div>
          <p>${escapeHtml(c.personalStoryTip || 'Add a short personal win, setback, or tip for your readers here.')}</p>
        </div>
        <div class="checklist-box">
          <div class="checklist-title">Action Checklist</div>
          <ul>${checks}</ul>
        </div>
      </section>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0; }
  .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; background: linear-gradient(135deg, ${color}14, #ffffff); border-left: 10px solid ${color}; border-radius: 12px; }
  .cover-tag { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${color}; }
  .cover h1 { font-size: 34px; line-height: 1.15; margin: 14px 0; color: #0f172a; }
  .cover-sub { font-size: 16px; color: #475569; max-width: 90%; }
  .cover-author { font-size: 14px; font-weight: 600; color: #334155; border-top: 1px solid #cbd5e1; padding-top: 14px; }
  .page-break { page-break-before: always; padding-top: 6px; }
  .toc h2, h2 { color: ${color}; font-size: 22px; margin-bottom: 12px; border-bottom: 2px solid ${color}33; padding-bottom: 6px; }
  .toc ul { list-style: none; padding: 0; }
  .toc li a { display: flex; justify-content: space-between; text-decoration: none; color: #1e293b; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 14px; }
  .chapter-kicker { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.6px; color: ${color}; }
  .chapter-body p { margin: 0 0 11px 0; font-size: 13.5px; color: #1e293b; }
  .svg-card { display: flex; align-items: center; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin: 12px 0; }
  .svg-caption { font-size: 12px; color: #475569; }
  .placeholder-box { border: 2px dashed ${color}; background: ${color}08; padding: 12px; border-radius: 10px; margin: 12px 0; font-size: 12px; }
  .callout { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 8px; margin: 16px 0; font-size: 13px; }
  .callout-title { font-weight: 700; color: #b45309; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
  .checklist-box { background: #f1f5f9; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
  .checklist-title { font-weight: 700; font-size: 13px; color: ${color}; margin-bottom: 6px; }
  .checklist-box ul { list-style: none; padding: 0; margin: 0; font-size: 12.5px; }
  .checklist-box li { margin-bottom: 4px; }
</style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="cover-tag">NTK Digital Edition</div>
      <h1>${escapeHtml(params.title)}</h1>
      <p class="cover-sub">${escapeHtml(params.subtitle)}</p>
    </div>
    <div class="cover-author">Prepared by ${escapeHtml(params.authorName || 'NTK Hub')}</div>
  </section>

  <section class="page-break toc">
    <h2>Table of Contents</h2>
    <ul>
      ${tocItems}
      <li><a href="#conclusion"><span>Conclusion & Next Steps</span><span>${params.chapters.length + 3}</span></a></li>
    </ul>
  </section>

  ${chapterHtml}

  <section class="page-break" id="conclusion">
    <div class="chapter-kicker">Final Word</div>
    <h2>Conclusion & Implementation Plan</h2>
    <p>${escapeHtml(params.conclusion)}</p>
  </section>
</body>
</html>`;

  return {
    html,
    fallbackSections: {
      title: params.title,
      subtitle: `${params.subtitle} — by ${params.authorName}`,
      blocks: [
        ...params.chapters.map((c) => ({
          heading: `Chapter ${c.number}: ${c.title}`,
          body: `${String(c.bodyHtml || '').replace(/<[^>]+>/g, '\n')}\n\n[Personal Story/Tip]: ${c.personalStoryTip || ''}\n\nChecklist:\n${(Array.isArray(c.checklist) ? c.checklist : []).map((x) => `- [ ] ${x}`).join('\n')}`,
        })),
        { heading: 'Conclusion', body: params.conclusion },
      ],
    },
  };
}

export function buildPlannerDocumentHtml(params: {
  title: string;
  theme: string;
  durationDays: 30 | 365;
  layoutStyle: string;
  brandColor: string;
  goals: string[];
  habits: string[];
  dailyPrompt: string;
}) {
  const color = params.brandColor || '#4F46E5';
  const totalPages = params.durationDays === 365 ? 365 : 30;
  // For 365-day hyperlinked PDF, render clean 12-month index + 365 hyperlinked anchors cleanly and fast
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const indexLinks =
    params.durationDays === 365
      ? monthNames
          .map((m, idx) => {
            const startDay = idx * 30 + 1;
            return `<a class="idx-pill" href="#day-${Math.min(startDay, 365)}">${m} (Day ${Math.min(startDay, 365)})</a>`;
          })
          .join('')
      : Array.from({ length: 30 }, (_, i) => i + 1)
          .map((d) => `<a class="idx-pill" href="#day-${d}">Day ${d}</a>`)
          .join('');

  // Render daily spreads (group 2 compact spreads per page on 365-day mode so Chromium renders 185 pages quickly under 4s!)
  const dayCards = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(
      (d) => `
      <div class="day-card ${params.durationDays === 30 ? 'page-break' : d % 2 === 1 ? 'page-break' : ''}" id="day-${d}">
        <div class="day-head">
          <span>Day ${String(d).padStart(3, '0')} — ${escapeHtml(params.theme)}</span>
          <a href="#index-top">Back to Index</a>
        </div>
        <div class="grid2">
          <div class="box"><strong>Top 3 Priorities</strong><div class="lines"></div></div>
          <div class="box"><strong>Daily Prompt: ${escapeHtml(params.dailyPrompt)}</strong><div class="lines"></div></div>
        </div>
        <div class="box" style="margin-top:8px;"><strong>Time Blocks & Gratitude</strong><div class="lines"></div></div>
      </div>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
  .cover { min-height: 245mm; padding: 28px; border: 3px solid ${color}; border-radius: 14px; display: flex; flex-direction: column; justify-content: space-between; }
  h1 { font-size: 32px; color: ${color}; margin: 0 0 10px 0; }
  .page-break { page-break-before: always; }
  .idx-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .idx-pill { display: inline-block; padding: 6px 10px; border: 1px solid ${color}; color: ${color}; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; }
  .day-card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
  .day-head { display: flex; justify-content: space-between; font-weight: 700; color: ${color}; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; font-size: 14px; }
  .day-head a { font-size: 11px; color: #64748b; text-decoration: none; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; font-size: 12px; }
  .lines { height: 70px; background: repeating-linear-gradient(transparent, transparent 20px, #e2e8f0 21px); margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; }
  th { background: ${color}; color: #fff; }
</style>
</head>
<body>
  <section class="cover">
    <div>
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:${color}">${escapeHtml(params.layoutStyle)} • ${params.durationDays}-Day Hyperlinked Edition</div>
      <h1>${escapeHtml(params.title)}</h1>
      <p style="color:#475569">${escapeHtml(params.theme)}</p>
    </div>
    <div style="font-size:13px;color:#334155">Includes Hyperlinked Navigation Index, Goal Milestones, Habit Tracker & Daily Spreads</div>
  </section>

  <section class="page-break" id="index-top">
    <h2 style="color:${color}">Hyperlinked Index & Goal Roadmap</h2>
    <div class="idx-grid">${indexLinks}</div>
    <h3 style="margin-top:20px;color:${color}">Core Goals</h3>
    <ul>${params.goals.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>
    <h3 style="margin-top:16px;color:${color}">Monthly Habit Tracker</h3>
    <table>
      <tr><th>Habit</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr>
      ${params.habits.map((h) => `<tr><td>${escapeHtml(h)}</td><td>&#9744;</td><td>&#9744;</td><td>&#9744;</td><td>&#9744;</td></tr>`).join('')}
    </table>
  </section>

  ${dayCards}
</body>
</html>`;

  return {
    html,
    fallbackSections: {
      title: params.title,
      subtitle: `${params.durationDays}-Day Planner (${params.theme})`,
      blocks: [
        { heading: 'Goals & Habits', body: `Goals:\n${params.goals.join('\n')}\n\nHabits:\n${params.habits.join('\n')}` },
        { heading: 'Daily Spread Template', body: `Total Days Covered: ${totalPages}\nDaily Reflection: ${params.dailyPrompt}` },
      ],
    },
  };
}

export function buildJournalWorkbookHtml(params: {
  title: string;
  journalType: string;
  brandColor: string;
  prompts: Array<{ number: number; title: string; guide: string; reflectionQuestions: string[] }>;
}) {
  const color = params.brandColor || '#4F46E5';
  const sections = params.prompts
    .map(
      (p) => `
    <section class="page-break">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${color}">Exercise ${p.number}</div>
      <h2 style="color:${color};margin:4px 0 8px 0">${escapeHtml(p.title)}</h2>
      <p style="font-size:13px;color:#334155">${escapeHtml(p.guide)}</p>
      ${p.reflectionQuestions
        .map(
          (q) => `
        <div class="prompt-box">
          <strong>${escapeHtml(q)}</strong>
          <div class="lines"></div>
        </div>`
        )
        .join('')}
    </section>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
  .cover { min-height: 245mm; padding: 28px; border-left: 10px solid ${color}; background: ${color}0c; display: flex; flex-direction: column; justify-content: space-between; }
  .page-break { page-break-before: always; }
  .prompt-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-top: 12px; font-size: 13px; }
  .lines { height: 92px; background: repeating-linear-gradient(transparent, transparent 22px, #cbd5e1 23px); margin-top: 10px; }
</style>
</head>
<body>
  <section class="cover">
    <div>
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:${color}">${escapeHtml(params.journalType)}</div>
      <h1 style="font-size:34px;margin:12px 0">${escapeHtml(params.title)}</h1>
    </div>
    <div style="font-size:13px;color:#475569">Printable & Tablet-Ready Guided Workbook</div>
  </section>
  ${sections}
</body>
</html>`;

  return {
    html,
    fallbackSections: {
      title: params.title,
      subtitle: params.journalType,
      blocks: params.prompts.map((p) => ({
        heading: `${p.number}. ${p.title}`,
        body: `${p.guide}\n\n${p.reflectionQuestions.map((q) => `- ${q}`).join('\n')}`,
      })),
    },
  };
}
