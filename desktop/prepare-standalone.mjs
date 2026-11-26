import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const STANDALONE_DIR = path.join(ROOT, '.next', 'standalone');
const STATIC_DIR = path.join(ROOT, '.next', 'static');
const PUBLIC_DIR = path.join(ROOT, 'public');
const BUNDLE_DIR = path.join(ROOT, 'desktop', 'server-bundle');

function findServerRoot(baseDir) {
  if (fs.existsSync(path.join(baseDir, 'server.js'))) {
    return baseDir;
  }
  const stack = [baseDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        const sub = path.join(dir, entry.name);
        if (fs.existsSync(path.join(sub, 'server.js'))) {
          return sub;
        }
        stack.push(sub);
      }
    }
  }
  throw new Error(`Could not locate server.js inside ${baseDir}. Run "npm run build" first.`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function removeIfExists(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function main() {
  if (!fs.existsSync(STANDALONE_DIR)) {
    throw new Error('Missing .next/standalone. Run "npm run build" before preparing desktop bundle.');
  }

  const serverRoot = findServerRoot(STANDALONE_DIR);
  console.log(`Found Next standalone server root: ${serverRoot}`);

  removeIfExists(BUNDLE_DIR);
  copyDir(serverRoot, BUNDLE_DIR);
  copyDir(STATIC_DIR, path.join(BUNDLE_DIR, '.next', 'static'));
  copyDir(PUBLIC_DIR, path.join(BUNDLE_DIR, 'public'));

  // Strip any personal data or secret files that standalone tracing might have copied
  for (const sensitive of ['.env', '.env.local', '.ntk-vault-key', 'FILES', 'files', 'storage', 'WORKING', 'ARCHIVE', 'DEPLOY_MANUAL', 'HANDOFF_TO_GEMINI']) {
    removeIfExists(path.join(BUNDLE_DIR, sensitive));
  }
  removeIfExists(path.join(BUNDLE_DIR, 'prisma', 'dev.db'));
  removeIfExists(path.join(BUNDLE_DIR, 'prisma', 'dev.db-journal'));

  // Ensure both Windows & Linux Prisma query engines are included in the bundle
  const srcPrismaClient = path.join(ROOT, 'node_modules', '.prisma', 'client');
  const dstPrismaClient = path.join(BUNDLE_DIR, 'node_modules', '.prisma', 'client');
  if (fs.existsSync(srcPrismaClient)) {
    fs.mkdirSync(dstPrismaClient, { recursive: true });
    for (const file of fs.readdirSync(srcPrismaClient)) {
      if (file.includes('query_engine') || file.endsWith('.node') || file === 'schema.prisma') {
        fs.copyFileSync(path.join(srcPrismaClient, file), path.join(dstPrismaClient, file));
      }
    }
  }

  // Ensure pdfkit AFM font metrics exist
  const srcPdfData = path.join(ROOT, 'node_modules', 'pdfkit', 'js', 'data');
  const dstPdfData = path.join(BUNDLE_DIR, 'node_modules', 'pdfkit', 'js', 'data');
  copyDir(srcPdfData, dstPdfData);

  // Node 22+/26+ resolves "module-sync" exports (e.g. require.mjs + index.mjs) that Next.js nft may omit
  const dstNodeModules = path.join(BUNDLE_DIR, 'node_modules');
  const srcNodeModules = path.join(ROOT, 'node_modules');
  const syncTracedEsmModules = (dstBase, srcBase) => {
    if (!fs.existsSync(dstBase) || !fs.existsSync(srcBase)) return;
    for (const entry of fs.readdirSync(dstBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dstPkg = path.join(dstBase, entry.name);
      const srcPkg = path.join(srcBase, entry.name);
      if (!fs.existsSync(srcPkg)) continue;
      if (entry.name.startsWith('@')) {
        syncTracedEsmModules(dstPkg, srcPkg);
        continue;
      }
      for (const f of fs.readdirSync(srcPkg, { withFileTypes: true })) {
        if (f.isFile() && (f.name.endsWith('.mjs') || f.name.endsWith('.cjs'))) {
          const dstFile = path.join(dstPkg, f.name);
          if (!fs.existsSync(dstFile)) {
            fs.copyFileSync(path.join(srcPkg, f.name), dstFile);
          }
        }
      }
      const nestedDst = path.join(dstPkg, 'node_modules');
      const nestedSrc = path.join(srcPkg, 'node_modules');
      if (fs.existsSync(nestedDst) && fs.existsSync(nestedSrc)) {
        syncTracedEsmModules(nestedDst, nestedSrc);
      }
    }
  };
  syncTracedEsmModules(dstNodeModules, srcNodeModules);

  // Create clean, freshly seeded template.db (no API keys, only 30 starter channels)
  const bundlePrismaDir = path.join(BUNDLE_DIR, 'prisma');
  fs.mkdirSync(bundlePrismaDir, { recursive: true });
  const templateDbPath = path.join(bundlePrismaDir, 'template.db');
  removeIfExists(templateDbPath);

  const dbUrl = `file:${templateDbPath.replace(/\\/g, '/')}`;
  console.log(`Creating clean template.db at ${templateDbPath}...`);
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npxCmd, ['prisma', 'db', 'push', '--skip-generate'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  execFileSync(npxCmd, ['tsx', 'prisma/seed.ts'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // Final safety assertions
  const forbidden = ['.ntk-vault-key', 'FILES', '.env'];
  for (const f of forbidden) {
    if (fs.existsSync(path.join(BUNDLE_DIR, f))) {
      throw new Error(`Security check failed: ${f} must not exist in desktop/server-bundle`);
    }
  }
  const engines = fs.readdirSync(dstPrismaClient).filter((f) => f.includes('query_engine'));
  console.log('Bundled Prisma engines:', engines);
  console.log('Desktop standalone server bundle ready at desktop/server-bundle');
}

main();
