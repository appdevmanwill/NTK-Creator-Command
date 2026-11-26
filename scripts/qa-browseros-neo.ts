import assert from 'assert';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { chromium, Page } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const CDP_PORTS = [9111, 9110];
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'WORKING', 'qa-screenshots');
const TEMP_DL_DIR = path.resolve(process.cwd(), 'WORKING', 'qa-downloads');

function resolveBrowserOsBinaryAndProfile(): { exe: string; profileDir: string } {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const exeCandidates = [
    path.join(localAppData, 'BrowserClaw', 'Application', 'chrome.exe'),
    path.join(localAppData, 'BrowserOS', 'Application', 'chrome.exe'),
    path.join(localAppData, 'BrowserOS Neo', 'Application', 'chrome.exe'),
  ];
  const exe = exeCandidates.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('Could not locate BrowserOS neo chrome.exe');

  let profileDir = 'FEAICCWS';
  const localStateCandidates = [
    path.join(localAppData, 'BrowserClaw', 'User Data', 'Local State'),
    path.join(localAppData, 'BrowserOS', 'User Data', 'Local State'),
  ];
  for (const lsPath of localStateCandidates) {
    if (!fs.existsSync(lsPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(lsPath, 'utf8')) as {
        profile?: { info_cache?: Record<string, { name?: string }> };
      };
      const cache = raw.profile?.info_cache ?? {};
      for (const [dirName, info] of Object.entries(cache)) {
        if (info?.name === 'FEAICCWS') {
          profileDir = dirName;
          break;
        }
      }
    } catch {
      // keep fallback
    }
  }
  return { exe, profileDir };
}

async function findAliveCdpUrl(): Promise<string | null> {
  for (const port of CDP_PORTS) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return `http://127.0.0.1:${port}`;
    } catch {
      // try next port
    }
  }
  return null;
}

async function ensureBrowserOsNeoOpen(): Promise<{ exe: string; profileDir: string; cdpUrl: string }> {
  const info = resolveBrowserOsBinaryAndProfile();
  const existingCdp = await findAliveCdpUrl();
  if (existingCdp) {
    console.log(`BrowserOS neo CDP already alive on ${existingCdp} (profile ${info.profileDir})`);
    return { ...info, cdpUrl: existingCdp };
  }

  console.log(`Launching BrowserOS neo natively with --profile-directory="${info.profileDir}"...`);
  const child = spawn(
    info.exe,
    [`--profile-directory=${info.profileDir}`, '--no-first-run', '--no-default-browser-check', BASE_URL],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  for (let i = 0; i < 30; i++) {
    const found = await findAliveCdpUrl();
    if (found) {
      console.log(`BrowserOS neo CDP ready on ${found}`);
      return { ...info, cdpUrl: found };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`BrowserOS neo CDP did not respond on ports ${CDP_PORTS.join(', ')} within 30s`);
}

async function downloadHrefBuffer(page: Page, href: string): Promise<Buffer> {
  const full = href.startsWith('http') ? href : `${BASE_URL}${href}`;
  const resp = await page.request.get(full);
  assert.strictEqual(resp.status(), 200, `Download ${full} failed with HTTP ${resp.status()}`);
  return Buffer.from(await resp.body());
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DL_DIR, { recursive: true });

  const { profileDir, cdpUrl } = await ensureBrowserOsNeoOpen();
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 15000 });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const httpErrors: string[] = [];
  let page: Page | undefined;

  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    page = await context.newPage();
    page.setDefaultTimeout(90000);

    page.on('pageerror', (err) => pageErrors.push(`${page!.url()}: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('favicon')) consoleErrors.push(`${page!.url()}: ${txt}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url().startsWith(BASE_URL)) {
        httpErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    // 1. Dashboard Home + Theme Toggle + Short Viewport 1365x600 Check
    console.log('QA 1/12: Dashboard Home, Adaptive Theme & Short Viewport...');
    await page.setViewportSize({ width: 1365, height: 600 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="pool-health-pill"]').filter({ hasText: /healthy|Zero-Key/i }).waitFor({ timeout: 15000 });
    const pillText = await page.locator('[data-testid="pool-health-pill"]').innerText();
    assert.ok(pillText.includes('healthy'), `Expected healthy keys in top bar, got: ${pillText}`);
    const hasHorizOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    assert.strictEqual(hasHorizOverflow, false, 'Unexpected horizontal overflow at 1365x600');
    await page.getByTitle('Theme: Light').click();
    assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
    await page.getByTitle('Theme: Dark').click();
    assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await page.getByTitle('Theme: System').click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png') });
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Admin API Key Vault — verify imported keys + live Test Key & Fetch Live Models
    console.log('QA 2/12: Admin Key Vault live tests...');
    await page.goto(`${BASE_URL}/admin/keys`, { waitUntil: 'networkidle' });
    const testButtons = page.locator('[data-testid^="test-key-"]');
    await testButtons.first().waitFor({ timeout: 15000 });
    const btnCount = await testButtons.count();
    assert.ok(btnCount >= 1, 'Expected imported keys in Admin Vault');
    const keyTestResults: Array<{ provider: string; result: string }> = [];
    for (let i = 0; i < btnCount; i++) {
      const btn = testButtons.nth(i);
      const tid = (await btn.getAttribute('data-testid')) || `key-${i}`;
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/keys/') && r.url().endsWith('/test'), {
          timeout: 35000,
        }),
        btn.click(),
      ]);
      const payload = (await resp.json()) as { ok?: boolean; testedModel?: string; models?: string[]; message?: string };
      keyTestResults.push({
        provider: tid,
        result: `${payload.ok ? 'OK' : 'FAIL'} (${payload.testedModel ?? 'n/a'}, ${payload.models?.length ?? 0} models): ${payload.message ?? ''}`,
      });
      await page.waitForTimeout(300);
    }
    console.log('Key test results:', JSON.stringify(keyTestResults, null, 2));
    assert.ok(
      keyTestResults.every((r) => r.result.startsWith('OK')),
      `Expected all imported keys to verify OK, got: ${JSON.stringify(keyTestResults)}`
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-admin-keys.png') });

    // 3. Google Flow Movie Pack
    console.log('QA 3/12: Google Flow AI Movie Pack...');
    await page.goto(`${BASE_URL}/packs/flow-movie`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Step 1: Generate Editable Outline/i }).click();
    await page.getByRole('button', { name: /Build Full Movie \.ZIP Pack/i }).waitFor({ timeout: 90000 });
    await page.getByRole('button', { name: /Build Full Movie \.ZIP Pack/i }).click();
    const flowZipLink = page.locator('a[href*="/api/projects/"][href$="/download"]');
    await flowZipLink.waitFor({ timeout: 120000 });
    const flowHref = await flowZipLink.getAttribute('href');
    assert.ok(flowHref, 'Missing Flow Movie download link');
    const flowBuf = await downloadHrefBuffer(page, flowHref);
    const flowZip = await JSZip.loadAsync(flowBuf);
    for (const reqFile of [
      'README.md',
      'characters.md',
      'locations.md',
      'flow_agent_instructions.md',
      'edit_instructions.md',
      'scenes/scene_01.md',
    ]) {
      const f = flowZip.file(reqFile);
      assert.ok(f, `Flow Movie zip missing ${reqFile}`);
      const content = await f.async('string');
      assert.ok(content.trim().length > 20, `Flow Movie ${reqFile} is empty`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-flow-movie.png') });

    // 4. Google Flow Bulk Style Cloner
    console.log('QA 4/12: Google Flow Bulk Style Cloner...');
    await page.goto(`${BASE_URL}/packs/flow-bulk`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Generate Copy-Paste Flow Block/i }).click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 90000 });
    const bulkHref = await page.locator('a[href*="/api/projects/"][href$="/download"]').getAttribute('href');
    assert.ok(bulkHref);
    const bulkZip = await JSZip.loadAsync(await downloadHrefBuffer(page, bulkHref));
    assert.ok(bulkZip.file('google_flow_bulk_block.txt'), 'Missing google_flow_bulk_block.txt');

    // 5. Kaggle & Colab Notebooks (.ipynb nbformat 4)
    console.log('QA 5/12: Kaggle & Colab GPU Notebooks...');
    await page.goto(`${BASE_URL}/packs/notebooks`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Generate Verified \.ipynb/i }).click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 60000 });
    const nbHref = await page.locator('a[href*="/api/projects/"][href$="/download"]').getAttribute('href');
    assert.ok(nbHref);
    const nbZip = await JSZip.loadAsync(await downloadHrefBuffer(page, nbHref));
    const ipynbStr = await nbZip.file('notebook.ipynb')!.async('string');
    const ipynbObj = JSON.parse(ipynbStr) as { nbformat: number; cells: unknown[] };
    assert.strictEqual(ipynbObj.nbformat, 4, 'Expected nbformat 4');
    assert.ok(ipynbObj.cells.length >= 4, 'Expected >= 4 notebook cells');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-notebooks.png') });

    // 6. Brand/Mascot & Universal Packs
    console.log('QA 6/12: Brand/Spy & Universal Packs...');
    await page.goto(`${BASE_URL}/packs/brand-and-spy`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Build Brand & Mascot \.ZIP/i }).click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 60000 });
    await page.goto(`${BASE_URL}/packs/universal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Compile Universal Playbook \.ZIP/i }).click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 60000 });

    // 7. Digital Product Studio — Ebook PDF, Formula XLSX, Planner PDF, Journal PDF
    console.log('QA 7/12: Digital Product Studio (PDF + XLSX)...');
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
    const [ebookResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/products/generate') && r.request().method() === 'POST', {
        timeout: 180000,
      }),
      page.getByTestId('generate-product-btn').click(),
    ]);
    assert.strictEqual(ebookResp.status(), 200, `Ebook generate failed HTTP ${ebookResp.status()}`);
    const ebookData = (await ebookResp.json()) as { projectId: string };
    await page.locator(`a[href="/api/projects/${ebookData.projectId}/download"]`).waitFor({ timeout: 15000 });
    const ebookBuf = await downloadHrefBuffer(page, `/api/projects/${ebookData.projectId}/download`);
    assert.strictEqual(ebookBuf.subarray(0, 5).toString('ascii'), '%PDF-', 'Ebook is not valid %PDF-');
    assert.ok(ebookBuf.byteLength > 10240, `Ebook PDF too small (${ebookBuf.byteLength} bytes)`);

    // Spreadsheet .xlsx + Recharts + formula verification
    await page.getByTestId('tab-SPREADSHEET').click();
    const [sheetResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/products/generate') && r.request().method() === 'POST', {
        timeout: 60000,
      }),
      page.getByTestId('generate-product-btn').click(),
    ]);
    assert.strictEqual(sheetResp.status(), 200, `Spreadsheet generate failed HTTP ${sheetResp.status()}`);
    const sheetData = (await sheetResp.json()) as { projectId: string };
    await page.locator(`a[href="/api/projects/${sheetData.projectId}/download"]`).waitFor({ timeout: 15000 });
    await page.locator('.recharts-wrapper').first().waitFor();
    const xlsxBuf = await downloadHrefBuffer(page, `/api/projects/${sheetData.projectId}/download`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxBuf as unknown as ArrayBuffer);
    const dashSheet = wb.getWorksheet('Dashboard');
    assert.ok(dashSheet, 'Missing Dashboard worksheet');
    const b2Val = dashSheet.getCell('B2').value as { formula?: string };
    assert.ok(
      b2Val?.formula?.includes('SUMIF'),
      `Expected real SUMIF formula in Dashboard!B2, got ${JSON.stringify(b2Val)}`
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-products-xlsx.png') });

    // Planner PDF & Journal PDF
    await page.getByTestId('tab-PLANNER').click();
    const [plannerResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/products/generate') && r.request().method() === 'POST', {
        timeout: 60000,
      }),
      page.getByTestId('generate-product-btn').click(),
    ]);
    assert.strictEqual(plannerResp.status(), 200);
    const plannerData = (await plannerResp.json()) as { projectId: string };
    await page.locator(`a[href="/api/projects/${plannerData.projectId}/download"]`).waitFor({ timeout: 15000 });
    const plannerBuf = await downloadHrefBuffer(page, `/api/projects/${plannerData.projectId}/download`);
    assert.strictEqual(plannerBuf.subarray(0, 5).toString('ascii'), '%PDF-');

    await page.getByTestId('tab-JOURNAL').click();
    const [journalResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/products/generate') && r.request().method() === 'POST', {
        timeout: 60000,
      }),
      page.getByTestId('generate-product-btn').click(),
    ]);
    assert.strictEqual(journalResp.status(), 200);
    const journalData = (await journalResp.json()) as { projectId: string };
    await page.locator(`a[href="/api/projects/${journalData.projectId}/download"]`).waitFor({ timeout: 15000 });
    const journalBuf = await downloadHrefBuffer(page, `/api/projects/${journalData.projectId}/download`);
    assert.strictEqual(journalBuf.subarray(0, 5).toString('ascii'), '%PDF-');

    // 8. Store Funnel & Product Analyzer
    console.log('QA 8/12: Store Funnel & Product Analyzer...');
    await page.goto(`${BASE_URL}/products/funnel`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Build Storefront Copy/i }).click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 60000 });

    await page.goto(`${BASE_URL}/products/analyzer`, { waitUntil: 'networkidle' });
    await page.getByTestId('analyze-product-btn').click();
    await page.getByTestId('product-analysis-result').waitFor({ timeout: 60000 });
    const prodTxt = await page.getByTestId('product-analysis-result').innerText();
    assert.ok(prodTxt.includes('Replication Score:'), 'Missing Replication Score');

    // 9. Faceless Finder & Trend Finder
    console.log('QA 9/12: Faceless Finder & Trend Finder...');
    await page.goto(`${BASE_URL}/research/faceless-finder`, { waitUntil: 'networkidle' });
    await page.getByTestId('channels-grid').waitFor();
    const initialCards = await page.locator('[data-testid="channels-grid"] > div').count();
    assert.ok(initialCards >= 25, `Expected seeded channels >= 25, got ${initialCards}`);
    await page.getByTestId('filter-digital-products').click();
    await page.waitForTimeout(500);
    const filteredCards = await page.locator('[data-testid="channels-grid"] > div').count();
    assert.ok(filteredCards > 0 && filteredCards < initialCards, 'Expected digital product filter to narrow results');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-faceless-finder.png') });

    await page.goto(`${BASE_URL}/research/trends`, { waitUntil: 'networkidle' });
    await page.getByTestId('analyze-trend-btn').click();
    await page.getByTestId('trend-result').waitFor({ timeout: 60000 });
    const trendsHref = await page.getByTestId('google-trends-link').getAttribute('href');
    assert.ok(trendsHref?.includes('gprop=youtube'), 'Expected Google Trends URL pre-set to YouTube Search');

    // 10. Viral Hook Coach & NotebookLM Blueprint
    console.log('QA 10/12: Viral Hook Coach & NotebookLM Blueprint...');
    await page.goto(`${BASE_URL}/coach`, { waitUntil: 'networkidle' });
    await page
      .getByTestId('coach-input')
      .fill('Give me 3 channel name ideas wrapped in [CHANNEL: Name] for a budget spreadsheet channel.');
    await page.getByTestId('coach-send').click();
    await page.locator('[data-testid="coach-messages"] a[href*="youtube.com"]').first().waitFor({ timeout: 60000 });

    await page.goto(`${BASE_URL}/notebooklm`, { waitUntil: 'networkidle' });
    await page.getByTestId('build-notebooklm-btn').click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 60000 });

    // 11. Publishing & OAuth Packs (Mode A + Mode B py_compile check)
    console.log('QA 11/12: Publishing & OAuth Packs (Mode A + Mode B)...');
    await page.goto(`${BASE_URL}/publish-packs`, { waitUntil: 'networkidle' });
    await page.getByTestId('generate-publish-btn').click();
    await page.locator('a[href*="/api/projects/"][href$="/download"]').waitFor({ timeout: 60000 });

    await page.getByTestId('mode-youtube-oauth').click();
    const [oauthResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/packs/publish') && r.request().method() === 'POST', {
        timeout: 60000,
      }),
      page.getByTestId('generate-publish-btn').click(),
    ]);
    assert.strictEqual(oauthResp.status(), 200);
    const oauthData = (await oauthResp.json()) as { projectId: string };
    await page.locator(`a[href="/api/projects/${oauthData.projectId}/download"]`).waitFor({ timeout: 15000 });
    const oauthZip = await JSZip.loadAsync(
      await downloadHrefBuffer(page, `/api/projects/${oauthData.projectId}/download`)
    );
    const pyScript = await oauthZip.file('youtube_uploader.py')!.async('string');
    const tempPy = path.join(TEMP_DL_DIR, 'youtube_uploader.py');
    fs.writeFileSync(tempPy, pyScript, 'utf8');
    execSync(`python -m py_compile "${tempPy}"`, { stdio: 'inherit' });

    // 12. Pack & Product Library
    console.log('QA 12/12: Library verification...');
    await page.goto(`${BASE_URL}/library`, { waitUntil: 'networkidle' });
    await page.getByTestId('library-list').waitFor();
    const libCount = await page.locator('[data-testid="library-list"] > div').count();
    assert.ok(libCount >= 8, `Expected >= 8 library artifacts, got ${libCount}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-library.png') });

    assert.strictEqual(pageErrors.length, 0, `Page errors detected:\n${pageErrors.join('\n')}`);
    assert.strictEqual(consoleErrors.length, 0, `Console errors detected:\n${consoleErrors.join('\n')}`);
    assert.strictEqual(httpErrors.length, 0, `HTTP >=400 errors detected:\n${httpErrors.join('\n')}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          cdpUrl,
          browserOsProfile: profileDir,
          verifiedRoutes: 13,
          keyTestResults,
          ebookPdfBytes: ebookBuf.byteLength,
          libraryArtifacts: libCount,
          pageErrors: 0,
          consoleErrors: 0,
          httpErrors: 0,
        },
        null,
        2
      )
    );
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('QA FAILED:', err);
  process.exit(1);
});
