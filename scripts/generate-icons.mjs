import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const SVG_PATH = path.join(ROOT, 'public', 'icon.svg');

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

function buildIcoFromPngs(entries) {
  // ICO header: 6 bytes, then 16 bytes per image, then raw PNG payloads
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4);

  const dirBuffers = [];
  const dataBuffers = [];
  let offset = 6 + count * 16;

  for (const { size, png } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2); // palette
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bpp
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirBuffers.push(dir);
    dataBuffers.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirBuffers, ...dataBuffers]);
}

async function main() {
  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  const executablePath = findBrowser();
  if (!executablePath) {
    throw new Error('No Chromium/Edge executable found to render NTK icons');
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  try {
    const renderPng = async (size, transparentBg = true) => {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;background:${transparentBg ? 'transparent' : '#111115'};display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden;">${svg.replace(/width="512"/, `width="${size}"`).replace(/height="512"/, `height="${size}"`)}</body></html>`);
      const buf = await page.screenshot({ type: 'png', omitBackground: transparentBg });
      await page.close();
      return buf;
    };

    const p512 = await renderPng(512);
    const p256 = await renderPng(256);
    const p192 = await renderPng(192);
    const p144 = await renderPng(144);
    const p96 = await renderPng(96);
    const p72 = await renderPng(72);
    const p48 = await renderPng(48);
    const p32 = await renderPng(32);
    const p16 = await renderPng(16);

    fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'public', 'icon-192.png'), p192);
    fs.writeFileSync(path.join(ROOT, 'public', 'icon-512.png'), p512);

    fs.mkdirSync(path.join(ROOT, 'desktop', 'build'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'desktop', 'build', 'icon.png'), p512);
    fs.writeFileSync(
      path.join(ROOT, 'desktop', 'build', 'icon.ico'),
      buildIcoFromPngs([
        { size: 256, png: p256 },
        { size: 48, png: p48 },
        { size: 32, png: p32 },
        { size: 16, png: p16 },
      ])
    );

    // Android mipmap icons
    const mipmaps = [
      ['mipmap-mdpi', p48],
      ['mipmap-hdpi', p72],
      ['mipmap-xhdpi', p96],
      ['mipmap-xxhdpi', p144],
      ['mipmap-xxxhdpi', p192],
    ];
    for (const [folder, buf] of mipmaps) {
      const dir = path.join(ROOT, 'android-app', 'app', 'src', 'main', 'res', folder);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);
    }

    // Also foreground PNG for adaptive icon (xxxhdpi 432x432 padded)
    const fgPage = await browser.newPage({ viewport: { width: 432, height: 432 }, deviceScaleFactor: 1 });
    await fgPage.setContent(`<!doctype html><html><body style="margin:0;padding:0;background:#111115;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;">${svg.replace(/width="512"/, 'width="280"').replace(/height="512"/, 'height="280"')}</body></html>`);
    const fgBuf = await fgPage.screenshot({ type: 'png' });
    await fgPage.close();
    const drawableDir = path.join(ROOT, 'android-app', 'app', 'src', 'main', 'res', 'drawable');
    fs.mkdirSync(drawableDir, { recursive: true });
    fs.writeFileSync(path.join(drawableDir, 'ic_launcher_foreground_img.png'), fgBuf);

    console.log('Generated PNG, ICO, and Android mipmap icons successfully.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
