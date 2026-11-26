import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const BUNDLE_DIR = path.join(ROOT, 'desktop', 'server-bundle');

function findBrowser() {
  const candidates = [];
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const pwDir = path.join(localAppData, 'ms-playwright');
  if (fs.existsSync(pwDir)) {
    for (const entry of fs.readdirSync(pwDir).filter((n) => n.startsWith('chromium-'))) {
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
  return candidates.find((c) => fs.existsSync(c));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function waitForHttp(url, timeoutMs = 25000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const ok = await new Promise((res) => {
        const req = http.get(url, (r) => {
          r.resume();
          res(r.statusCode === 200);
        });
        req.on('error', () => res(false));
      });
      if (ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function postJson(baseUrl, route, body) {
  const res = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${route} returned HTTP ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function verifyDownloadHeader(baseUrl, projectId, expectedPrefix) {
  const dl = await fetch(`${baseUrl}/api/projects/${projectId}/download`);
  if (!dl.ok) throw new Error(`Download ${projectId} returned HTTP ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  if (buf.subarray(0, expectedPrefix.length).toString('ascii') !== expectedPrefix) {
    throw new Error(`Downloaded ${projectId} did not start with ${expectedPrefix}`);
  }
  return buf.byteLength;
}

async function main() {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntk-smoke-'));
  const templateDb = path.join(BUNDLE_DIR, 'prisma', 'template.db');
  const tempDb = path.join(tempDataDir, 'test.db');
  fs.copyFileSync(templateDb, tempDb);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, [path.join(BUNDLE_DIR, 'server.js')], {
    cwd: BUNDLE_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      NTK_DATA_DIR: tempDataDir,
      DATABASE_URL: `file:${tempDb.replace(/\\/g, '/')}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  proc.stdout.on('data', (d) => (logs += d.toString()));
  proc.stderr.on('data', (d) => (logs += d.toString()));

  const browserPath = findBrowser();
  if (!browserPath) throw new Error('No Chromium/Edge executable for Playwright smoke test');
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });

  try {
    await waitForHttp(`${baseUrl}/api/dashboard`);
    const dashRes = await fetch(`${baseUrl}/api/dashboard`);
    const dash = await dashRes.json();
    if (dash.stats.keysCount !== 0) {
      throw new Error(`Security check failed: expected 0 keys in template.db, found ${dash.stats.keysCount}`);
    }
    if (dash.stats.channelsCount !== 30) {
      throw new Error(`Expected 30 seeded channels in template.db, found ${dash.stats.channelsCount}`);
    }

    // Offline E2E test for ALL product and pack generators (0 API keys)
    const ebook = await postJson(baseUrl, '/api/products/generate', {
      kind: 'EBOOK',
      title: 'Offline Compounder Guide',
      topic: 'Cashflow audits and first digital product',
      chapterCount: 3,
    });
    await verifyDownloadHeader(baseUrl, ebook.projectId, '%PDF-');

    const xlsx = await postJson(baseUrl, '/api/products/generate', {
      kind: 'SPREADSHEET',
      title: 'Offline Budget Model',
      prompt: 'Track income and expenses',
    });
    await verifyDownloadHeader(baseUrl, xlsx.projectId, 'PK');

    const planner = await postJson(baseUrl, '/api/products/generate', {
      kind: 'PLANNER',
      title: 'Offline 30 Day Planner',
      theme: 'Daily execution',
      durationDays: 30,
    });
    await verifyDownloadHeader(baseUrl, planner.projectId, '%PDF-');

    const journal = await postJson(baseUrl, '/api/products/generate', {
      kind: 'JOURNAL',
      title: 'Offline Clarity Workbook',
      topic: 'Weekly spending reflection',
    });
    await verifyDownloadHeader(baseUrl, journal.projectId, '%PDF-');

    const outlineRes = await postJson(baseUrl, '/api/packs/flow-movie/outline', {
      format: 'ONE_OFF',
      aspectRatio: '16:9',
      runtimeMinutes: 2,
      outlineMode: 'ONE_LINE',
      idea: 'A courier finds a coded brass key in the rain',
    });
    const movieRes = await postJson(baseUrl, '/api/packs/flow-movie', {
      format: 'ONE_OFF',
      aspectRatio: '16:9',
      runtimeMinutes: 2,
      outline: outlineRes.outline,
    });
    await verifyDownloadHeader(baseUrl, movieRes.projectId, 'PK');

    const bulkRes = await postJson(baseUrl, '/api/packs/flow-bulk', {
      title: 'Offline Stickman Explainer',
      topic: 'How compound savings work',
      aspectRatio: '16:9',
      targetMinutes: 1,
      styleHeader: 'Minimalist black ink stickman on warm cream paper',
    });
    await verifyDownloadHeader(baseUrl, bulkRes.projectId, 'PK');

    const brandRes = await postJson(baseUrl, '/api/packs/brand-and-spy', {
      mode: 'BRAND_PACK',
      brandOrKeyword: 'Quiet Ledger',
      niche: 'Money & Finance',
    });
    await verifyDownloadHeader(baseUrl, brandRes.projectId, 'PK');

    const funnelRes = await postJson(baseUrl, '/api/products/funnel', {
      productTitle: 'Offline Compounder Guide',
      productSummary: 'Step-by-step cashflow edition',
      platform: 'PAYHIP',
    });
    await verifyDownloadHeader(baseUrl, funnelRes.projectId, 'PK');

    const univRes = await postJson(baseUrl, '/api/packs/universal', {
      platformName: 'CapCut',
      platformUrl: 'https://www.capcut.com',
      creativeGoal: 'Edit vertical short reel',
    });
    await verifyDownloadHeader(baseUrl, univRes.projectId, 'PK');

    const coachRes = await postJson(baseUrl, '/api/coach/chat', {
      message: 'Give me 3 hooks for a budgeting channel',
    });
    if (!coachRes.message?.content) throw new Error('Coach offline reply missing');

    // Airplane-Mode Playwright UI verification (block ALL external internet URLs!)
    const routes = ['/', '/products', '/research/faceless-finder', '/packs/flow-movie', '/coach', '/library', '/admin/keys'];
    for (const vp of [
      { name: 'mobile', width: 360, height: 800 },
      { name: 'desktop', width: 1280, height: 800 },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(`http://127.0.0.1:${port}`) || u.startsWith('data:') || u.startsWith('blob:')) {
          return route.continue();
        }
        return route.abort('internetdisconnected');
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
      });

      for (const route of routes) {
        const resp = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        if (!resp || resp.status() !== 200) {
          throw new Error(`${vp.name} ${route} returned HTTP ${resp?.status()}`);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
        if (overflow) {
          const sw = await page.evaluate(() => document.documentElement.scrollWidth);
          throw new Error(`${vp.name} ${route} horizontal overflow: scrollWidth=${sw} > innerWidth=${vp.width}`);
        }
      }
      if (errors.length > 0) {
        throw new Error(`${vp.name} airplane-mode console/page errors:\n${errors.join('\n')}`);
      }
      await ctx.close();
    }

    console.log('ALL AIRPLANE-MODE DESKTOP & MOBILE E2E TESTS PASSED (ALL 10 OFFLINE MODULES + 0 EXTERNAL REQUESTS)!');
  } catch (err) {
    console.error('Server logs:\n', logs);
    throw err;
  } finally {
    await browser.close();
    if (proc.exitCode === null) {
      await new Promise((resolve) => {
        proc.once('exit', resolve);
        proc.kill();
        setTimeout(resolve, 3000);
      });
    }
    try {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    } catch {
      // ignore Windows temp handle delay
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
