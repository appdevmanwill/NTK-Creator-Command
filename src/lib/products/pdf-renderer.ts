import fs from 'fs';
import os from 'os';
import path from 'path';
import PDFDocument from 'pdfkit';
import { chromium } from 'playwright';

function findBrowserExecutable(): string | undefined {
  const candidates: string[] = [];

  if (process.env.NTK_CHROMIUM_PATH) {
    candidates.push(process.env.NTK_CHROMIUM_PATH);
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const pwDir = path.join(localAppData, 'ms-playwright');
    if (fs.existsSync(pwDir)) {
      const entries = fs.readdirSync(pwDir).filter((n) => n.startsWith('chromium-'));
      for (const entry of entries) {
        candidates.push(
          path.join(pwDir, entry, 'chrome-win64', 'chrome.exe'),
          path.join(pwDir, entry, 'chrome-win', 'chrome.exe')
        );
      }
    }
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (process.platform === 'linux') {
    const pwDir = path.join(os.homedir(), '.cache', 'ms-playwright');
    if (fs.existsSync(pwDir)) {
      const entries = fs.readdirSync(pwDir).filter((n) => n.startsWith('chromium-'));
      for (const entry of entries) {
        candidates.push(path.join(pwDir, entry, 'chrome-linux', 'chrome'));
      }
    }
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
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

  // Guaranteed PDFKit Fallback (100% offline, zero external browser or font downloads required)
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: fallbackSections.title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Clean Obsidian & Champagne editorial cover
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#111115');
    doc
      .rect(28, 28, doc.page.width - 56, doc.page.height - 56)
      .lineWidth(1)
      .strokeColor('#D4AF37')
      .stroke();
    doc
      .fontSize(10)
      .fillColor('#D4AF37')
      .text('NTK CREATOR COMMAND · DIGITAL EDITION', 48, 64, { characterSpacing: 1.5 });
    doc
      .fontSize(28)
      .fillColor('#F5F1E8')
      .text(fallbackSections.title, 48, 120, { width: doc.page.width - 96, align: 'left' });
    if (fallbackSections.subtitle) {
      doc
        .moveDown(0.75)
        .fontSize(13)
        .fillColor('#B9B1A3')
        .text(fallbackSections.subtitle, { width: doc.page.width - 96, lineGap: 4 });
    }
    doc
      .fontSize(11)
      .fillColor('#D4AF37')
      .text('Compiled Locally — Offline Editorial Engine', 48, doc.page.height - 86);

    for (const blk of fallbackSections.blocks) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F6F3EC');
      doc.fillColor('#9E7318').rect(48, 48, 44, 3).fill();
      doc.fontSize(18).fillColor('#141210').text(blk.heading, 48, 64, { width: doc.page.width - 96 });
      doc.moveDown(0.7);
      doc.fontSize(11).fillColor('#2C2823').text(blk.body, { width: doc.page.width - 96, lineGap: 5 });
    }
    doc.end();
  });

  return { buffer, engine: 'pdfkit-fallback' };
}
