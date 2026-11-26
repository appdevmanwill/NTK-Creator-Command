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
  const accent = brandColor || '#9E7318';
  const variant = chapterNumber % 3;
  const shapes =
    variant === 1
      ? `<rect x="28" y="18" width="164" height="84" rx="8" fill="#FAF8F4" stroke="${accent}" stroke-width="1.2"/><circle cx="76" cy="60" r="24" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="1.4"/><path d="M68 60L74 66L86 53" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><line x1="114" y1="50" x2="174" y2="50" stroke="#141210" stroke-width="2"/><line x1="114" y1="62" x2="162" y2="62" stroke="#5C564C" stroke-width="1.4"/><line x1="114" y1="73" x2="148" y2="73" stroke="#5C564C" stroke-width="1.4"/>`
      : variant === 2
      ? `<rect x="28" y="18" width="164" height="84" rx="8" fill="#FAF8F4" stroke="${accent}" stroke-width="1.2"/><rect x="54" y="64" width="20" height="24" rx="2" fill="${accent}" fill-opacity="0.35"/><rect x="84" y="50" width="20" height="38" rx="2" fill="${accent}" fill-opacity="0.65"/><rect x="114" y="34" width="20" height="54" rx="2" fill="${accent}"/><rect x="144" y="26" width="20" height="62" rx="2" fill="#141210"/>`
      : `<rect x="28" y="18" width="164" height="84" rx="8" fill="#FAF8F4" stroke="${accent}" stroke-width="1.2"/><polygon points="110,26 146,88 74,88" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-width="1.4"/><circle cx="110" cy="64" r="14" fill="#141210"/><circle cx="110" cy="64" r="5" fill="${accent}"/>`;

  return `
  <div class="svg-card">
    <svg width="220" height="112" viewBox="0 0 220 112" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>
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
  const color = params.brandColor || '#9E7318';
  const tocItems = params.chapters
    .map(
      (c) =>
        `<li><a href="#ch-${c.number}"><span><span class="toc-num">${String(c.number).padStart(2, '0')}</span> ${escapeHtml(c.title)}</span><span class="toc-pg">${c.number + 2}</span></a></li>`
    )
    .join('');

  const chapterHtml = params.chapters
    .map((c) => {
      const promptText = c.illustrationPrompt || c.title || 'Chapter plate';
      const visual =
        params.illustrationMode === 'FLAT_SVG'
          ? flatSvgIllustration(c.number, color, promptText)
          : `<div class="placeholder-box"><strong>Editorial Plate Prompt — Paste into Google Flow / Nano Banana</strong><p>${escapeHtml(promptText)}</p></div>`;
      const checks = (Array.isArray(c.checklist) ? c.checklist : [])
        .map((item) => `<li><span class="check-box">&#9744;</span><span>${escapeHtml(item)}</span></li>`)
        .join('');

      return `
      <section class="page-break" id="ch-${c.number}">
        <div class="chapter-kicker">Chapter ${String(c.number).padStart(2, '0')}</div>
        <h2>${escapeHtml(c.title)}</h2>
        ${visual}
        <div class="chapter-body">${c.bodyHtml || '<p>Structured walkthrough and deliberate implementation notes.</p>'}</div>
        <div class="callout">
          <div class="callout-title">Author Margin Note</div>
          <p>${escapeHtml(c.personalStoryTip || 'Insert a concise real-world story, observation, or field lesson here.')}</p>
        </div>
        <div class="checklist-box">
          <div class="checklist-title">Execution Checklist</div>
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
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #141210; line-height: 1.68; margin: 0; background: #ffffff; }
  .cover {
    min-height: 242mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 34px;
    background: #FAF8F4;
    border: 1px solid #DFD5C3;
    box-shadow: inset 0 0 0 8px #FAF8F4, inset 0 0 0 9px ${color}66;
    box-sizing: border-box;
  }
  .cover-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${color}55; padding-bottom: 14px; }
  .cover-tag { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.6px; color: ${color}; }
  .cover-edition { font-size: 10.5px; letter-spacing: 1.8px; text-transform: uppercase; color: #5C564C; }
  .cover-center { padding: 36px 0; }
  .cover h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 40px; font-weight: 600; line-height: 1.1; margin: 0 0 18px 0; color: #141210; letter-spacing: -0.02em; }
  .cover-rule { width: 64px; height: 2px; background: ${color}; margin-bottom: 18px; }
  .cover-sub { font-size: 15.5px; color: #4A443C; max-width: 88%; line-height: 1.6; }
  .cover-author { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; font-weight: 600; color: #2E2A25; border-top: 1px solid #DFD5C3; padding-top: 14px; text-transform: uppercase; letter-spacing: 1.5px; }
  .page-break { page-break-before: always; padding-top: 6px; }
  h2 { font-family: Georgia, 'Times New Roman', serif; color: #141210; font-size: 25px; font-weight: 600; margin: 4px 0 14px 0; border-bottom: 1px solid ${color}55; padding-bottom: 8px; letter-spacing: -0.01em; }
  .toc ul { list-style: none; padding: 0; margin-top: 18px; }
  .toc li a { display: flex; justify-content: space-between; align-items: baseline; text-decoration: none; color: #141210; padding: 10px 0; border-bottom: 1px solid #EAE3D5; font-size: 14px; }
  .toc-num { font-family: Georgia, serif; font-weight: 700; color: ${color}; margin-right: 10px; }
  .toc-pg { font-size: 12px; color: #5C564C; }
  .chapter-kicker { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.2px; color: ${color}; }
  .chapter-body p { margin: 0 0 12px 0; font-size: 13.5px; color: #26221E; }
  .svg-card { display: flex; align-items: center; gap: 16px; background: #FAF8F4; border: 1px solid #E2D9C8; border-radius: 10px; padding: 10px 14px; margin: 14px 0 16px 0; }
  .svg-caption { font-size: 12px; color: #5C564C; line-height: 1.45; }
  .placeholder-box { border: 1px dashed ${color}; background: #FAF8F4; padding: 14px; border-radius: 10px; margin: 14px 0; font-size: 12px; color: #4A443C; }
  .callout { background: #FAF8F4; border-left: 3px solid ${color}; border-top: 1px solid #EAE3D5; border-right: 1px solid #EAE3D5; border-bottom: 1px solid #EAE3D5; padding: 14px 16px; margin: 18px 0; font-size: 13px; }
  .callout-title { font-weight: 700; color: ${color}; margin-bottom: 4px; font-size: 10.5px; letter-spacing: 1.6px; text-transform: uppercase; }
  .callout p { margin: 0; color: #26221E; }
  .checklist-box { background: #141210; color: #F5F1E8; border-radius: 10px; padding: 14px 18px; margin-top: 16px; }
  .checklist-title { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1.6px; color: #E5C158; margin-bottom: 8px; }
  .checklist-box ul { list-style: none; padding: 0; margin: 0; font-size: 12.5px; }
  .checklist-box li { display: flex; gap: 8px; margin-bottom: 5px; }
  .check-box { color: #D4AF37; }
</style>
</head>
<body>
  <section class="cover">
    <div class="cover-top">
      <div class="cover-tag">NTK Signature Edition</div>
      <div class="cover-edition">Digital Monograph</div>
    </div>
    <div class="cover-center">
      <h1>${escapeHtml(params.title)}</h1>
      <div class="cover-rule"></div>
      <p class="cover-sub">${escapeHtml(params.subtitle)}</p>
    </div>
    <div class="cover-author">
      <span>Authored by ${escapeHtml(params.authorName || 'NTK Hub')}</span>
      <span>Private Press</span>
    </div>
  </section>

  <section class="page-break toc">
    <div class="chapter-kicker">Index</div>
    <h2>Table of Contents</h2>
    <ul>
      ${tocItems}
      <li><a href="#conclusion"><span><span class="toc-num">End</span> Conclusion &amp; Next Steps</span><span class="toc-pg">${params.chapters.length + 3}</span></a></li>
    </ul>
  </section>

  ${chapterHtml}

  <section class="page-break" id="conclusion">
    <div class="chapter-kicker">Closing Folio</div>
    <h2>Conclusion &amp; Implementation Plan</h2>
    <div class="chapter-body"><p>${escapeHtml(params.conclusion)}</p></div>
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
          body: `${String(c.bodyHtml || '').replace(/<[^>]+>/g, '\n')}\n\n[Author Margin Note]: ${c.personalStoryTip || ''}\n\nChecklist:\n${(Array.isArray(c.checklist) ? c.checklist : []).map((x) => `- [ ] ${x}`).join('\n')}`,
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
  const color = params.brandColor || '#9E7318';
  const totalPages = params.durationDays === 365 ? 365 : 30;
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

  const dayCards = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(
      (d) => `
      <div class="day-card ${params.durationDays === 30 ? 'page-break' : d % 2 === 1 ? 'page-break' : ''}" id="day-${d}">
        <div class="day-head">
          <span>Day ${String(d).padStart(3, '0')} · ${escapeHtml(params.theme)}</span>
          <a href="#index-top">Index &uarr;</a>
        </div>
        <div class="grid2">
          <div class="box"><strong>Primary Priorities</strong><div class="lines"></div></div>
          <div class="box"><strong>Prompt: ${escapeHtml(params.dailyPrompt)}</strong><div class="lines"></div></div>
        </div>
        <div class="box" style="margin-top:8px;"><strong>Schedule Blocks &amp; Evening Review</strong><div class="lines"></div></div>
      </div>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #141210; margin: 0; }
  .cover {
    min-height: 245mm;
    padding: 34px;
    background: #FAF8F4;
    border: 1px solid #DFD5C3;
    box-shadow: inset 0 0 0 8px #FAF8F4, inset 0 0 0 9px ${color}66;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
  }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 36px; font-weight: 600; color: #141210; margin: 12px 0 10px 0; line-height: 1.12; }
  h2, h3 { font-family: Georgia, 'Times New Roman', serif; color: #141210; }
  .page-break { page-break-before: always; }
  .idx-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .idx-pill { display: inline-block; padding: 6px 11px; border: 1px solid ${color}88; background: #FAF8F4; color: #141210; border-radius: 6px; text-decoration: none; font-size: 11.5px; font-weight: 600; }
  .day-card { border: 1px solid #DFD5C3; border-radius: 10px; padding: 14px; margin-bottom: 14px; background: #ffffff; }
  .day-head { display: flex; justify-content: space-between; font-weight: 700; color: ${color}; border-bottom: 1px solid #EAE3D5; padding-bottom: 6px; margin-bottom: 10px; font-size: 13px; letter-spacing: 0.4px; }
  .day-head a { font-size: 11px; color: #5C564C; text-decoration: none; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .box { border: 1px solid #E5DDD0; border-radius: 8px; padding: 10px; font-size: 12px; background: #FAF8F4; }
  .lines { height: 70px; background: repeating-linear-gradient(transparent, transparent 20px, #DFD5C3 21px); margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { border: 1px solid #DFD5C3; padding: 8px; text-align: left; }
  th { background: #141210; color: #F5ECD6; text-transform: uppercase; font-size: 10.5px; letter-spacing: 1px; }
</style>
</head>
<body>
  <section class="cover">
    <div>
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:2.2px;color:${color}">${escapeHtml(params.layoutStyle)} · ${params.durationDays}-Day Hyperlinked Edition</div>
      <h1>${escapeHtml(params.title)}</h1>
      <div style="width:56px;height:2px;background:${color};margin:14px 0;"></div>
      <p style="color:#4A443C;font-size:15px;">${escapeHtml(params.theme)}</p>
    </div>
    <div style="font-size:12px;color:#5C564C;border-top:1px solid #DFD5C3;padding-top:12px;text-transform:uppercase;letter-spacing:1.4px;">
      Hyperlinked Navigation Index · Core Milestones · Habit Cadence · Daily Folios
    </div>
  </section>

  <section class="page-break" id="index-top">
    <h2>Hyperlinked Index &amp; Goal Roadmap</h2>
    <div class="idx-grid">${indexLinks}</div>
    <h3 style="margin-top:20px;">Core Objectives</h3>
    <ul>${params.goals.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>
    <h3 style="margin-top:16px;">Monthly Habit Cadence</h3>
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
  const color = params.brandColor || '#9E7318';
  const sections = params.prompts
    .map(
      (p) => `
    <section class="page-break">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${color}">Exercise ${String(p.number).padStart(2, '0')}</div>
      <h2 style="font-family:Georgia,serif;color:#141210;margin:6px 0 8px 0;border-bottom:1px solid ${color}55;padding-bottom:6px">${escapeHtml(p.title)}</h2>
      <p style="font-size:13px;color:#4A443C;line-height:1.6">${escapeHtml(p.guide)}</p>
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
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #141210; margin: 0; }
  .cover {
    min-height: 242mm;
    padding: 34px;
    background: #FAF8F4;
    border: 1px solid #DFD5C3;
    box-shadow: inset 0 0 0 8px #FAF8F4, inset 0 0 0 9px ${color}66;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
  }
  .page-break { page-break-before: always; }
  .prompt-box { border: 1px solid #E2D9C8; background: #FAF8F4; border-radius: 10px; padding: 14px; margin-top: 12px; font-size: 13px; }
  .lines { height: 92px; background: repeating-linear-gradient(transparent, transparent 22px, #DFD5C3 23px); margin-top: 10px; }
</style>
</head>
<body>
  <section class="cover">
    <div>
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:2.2px;color:${color}">${escapeHtml(params.journalType)}</div>
      <h1 style="font-family:Georgia,serif;font-size:38px;font-weight:600;margin:14px 0;line-height:1.12">${escapeHtml(params.title)}</h1>
      <div style="width:56px;height:2px;background:${color};margin-top:12px;"></div>
    </div>
    <div style="font-size:12px;color:#5C564C;border-top:1px solid #DFD5C3;padding-top:12px;text-transform:uppercase;letter-spacing:1.4px;">
      Print &amp; Stylus-Ready Guided Edition · NTK Private Press
    </div>
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
