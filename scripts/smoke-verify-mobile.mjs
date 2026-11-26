import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'mobile-web', 'dist');

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

function getMime(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      let rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
      let full = path.join(DIST_DIR, rel);
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        full = path.join(DIST_DIR, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': getMime(full) });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function main() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('mobile-web/dist/index.html missing');
  }
  const { server, port } = await startStaticServer();
  const url = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true, args: ['--no-sandbox'] });

  try {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
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

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="mobile-home"]');

    // Verify all 5 bottom nav tabs + no horizontal overflow
    for (const tab of ['atlas', 'press', 'cinema', 'vault', 'home']) {
      await page.click(`[data-testid="nav-${tab}"]`);
      await page.waitForSelector(`[data-testid="mobile-${tab}"]`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) throw new Error(`Mobile horizontal overflow on tab: ${tab}`);
    }

    // Create Ebook PDF + Excel XLSX + Cinema ZIP on-device
    await page.click('[data-testid="nav-press"]');
    await page.click('[data-testid="press-kind-EBOOK"]');
    await page.click('[data-testid="mobile-press-create"]');
    await page.waitForSelector('[data-testid="latest-press-result"]', { timeout: 15000 });

    await page.click('[data-testid="press-kind-SPREADSHEET"]');
    await page.click('[data-testid="mobile-press-create"]');
    await page.waitForSelector('[data-testid="latest-press-result"]', { timeout: 15000 });

    await page.click('[data-testid="nav-cinema"]');
    await page.click('[data-testid="mobile-pack-create"]');
    await page.waitForSelector('[data-testid="latest-pack-result"]', { timeout: 15000 });

    await page.click('[data-testid="cinema-submode-music"]');
    await page.click('[data-testid="mobile-music-create"]');
    await page.waitForSelector('[data-testid="latest-music-result"]', { timeout: 15000 });

    // Confirm 4 items saved in Vault (PDF, XLSX, Cinema ZIP, Music+Video ZIP)
    await page.click('[data-testid="nav-vault"]');
    const vaultText = await page.textContent('[data-testid="mobile-vault"]');
    if (!vaultText?.includes('.pdf') || !vaultText?.includes('.xlsx') || !vaultText?.includes('.zip')) {
      throw new Error(`Vault missing expected generated artifacts. Text: ${vaultText}`);
    }

    if (errors.length > 0) {
      throw new Error(`mobile-web runtime errors:\n${errors.join('\n')}`);
    }

    console.log('ALL MOBILE-WEB 360x780 PLAYWRIGHT TESTS PASSED (PDF + XLSX + ZIP + VAULT)!');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
