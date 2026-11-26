import fs from 'fs';
import os from 'os';
import path from 'path';
import PDFDocument from 'pdfkit';
import { chromium } from 'playwright';

function findBrowserExecutable(): string | undefined {
  const candidates: string[] = [];

  // Check Playwright cache (%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win*\chrome.exe)
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const pwDir = path.join(localAppData, 'ms-playwright');
  if (fs.existsSync(pwDir)) {
    const entries = fs.readdirSync(pwDir).filter((n) => n.startsWith('chromium-'));
    for (const entry of entries) {
      const p1 = path.join(pwDir, entry, 'chrome-win64', 'chrome.exe');
      const p2 = path.join(pwDir, entry, 'chrome-win', 'chrome.exe');
      candidates.push(p1, p2);
    }
  }

  // Standard Chrome / Edge fallbacks on Windows
  candidates.push(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  );

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

export async function renderHtmlToPdfBuffer(
  html: string,
  fallbackSections: { title: string; subtitle?: string; blocks: Array<{ heading: string; body: string }> }
): Promise<{ buffer: Buffer; engine: 'playwright-chromium' | 'pdfkit-fallback' }> {
  const executablePath = findBrowserExecutable();
  if (executablePath) {
    let browser;
    try {
      browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
      });
      const buffer = Buffer.from(pdfBytes);
      if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return { buffer, engine: 'playwright-chromium' };
      }
    } catch {
      // Fall through to PDFKit
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  // Guaranteed PDFKit Fallback
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: fallbackSections.title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).fillColor('#1e1b4b').text(fallbackSections.title, { align: 'left' });
    if (fallbackSections.subtitle) {
      doc.moveDown(0.5).fontSize(12).fillColor('#475569').text(fallbackSections.subtitle);
    }
    doc.moveDown(1.2);

    for (const blk of fallbackSections.blocks) {
      doc.addPage();
      doc.fontSize(16).fillColor('#312e81').text(blk.heading);
      doc.moveDown(0.6);
      doc.fontSize(11).fillColor('#1e293b').text(blk.body, { lineGap: 4 });
    }
    doc.end();
  });

  return { buffer, engine: 'pdfkit-fallback' };
}
