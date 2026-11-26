import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';

const ROOT = process.cwd();
const BUNDLE_DIR = path.join(ROOT, 'desktop', 'server-bundle');

const PLATFORMS = [
  'GOOGLE_FLOW',
  'SUNO',
  'TREBLO',
  'ACE_STUDIO',
  'UDIO',
  'MUREKA',
  'RIFFUSION',
  'ELEVENLABS_MUSIC',
  'COLAB_KAGGLE_OPEN',
  'ALL_PLATFORMS_MASTER',
];

const NOTEBOOK_TEMPLATES = [
  'AI_MUSIC',
  'MUSIC_VIDEO_SHORTS',
  'TALKING_PROMO',
  'WHISPER_UPSCALE',
];

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

async function downloadZip(baseUrl, projectId) {
  const dl = await fetch(`${baseUrl}/api/projects/${projectId}/download`);
  if (!dl.ok) throw new Error(`Download ${projectId} returned HTTP ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  if (buf.subarray(0, 2).toString('ascii') !== 'PK') {
    throw new Error(`Project ${projectId} is not a valid ZIP (missing PK header)`);
  }
  return JSZip.loadAsync(buf);
}

function validateNotebookAndCompilePython(ipynbRaw, label, tempPyDir, index) {
  const nb = JSON.parse(ipynbRaw);
  if (nb.nbformat !== 4) {
    throw new Error(`${label}: expected nbformat === 4, got ${nb.nbformat}`);
  }
  if (!Array.isArray(nb.cells) || nb.cells.length < 3) {
    throw new Error(`${label}: notebook has fewer than 3 cells`);
  }

  const fullText = JSON.stringify(nb);
  const bannedPhrases = [
    'GPT-Neo',
    'batch_size=4',
    'max_length=256',
    'Place Flow clips or generated frames in ./inputs/ and run the FFmpeg beat-sync cell below',
  ];
  for (const banned of bannedPhrases) {
    if (fullText.includes(banned)) {
      throw new Error(`${label}: found banned hallucinated/stub phrase: "${banned}"`);
    }
  }

  if (!fullText.includes('ACESTEP_DTYPE') && label.includes('MUSIC')) {
    throw new Error(`${label}: missing ACESTEP_DTYPE T4 float32 NaN protection`);
  }
  if (
    !fullText.includes('outputs') ||
    (!fullText.includes('assert len(') && !fullText.includes('assert os.path.exists(') && !fullText.includes('RuntimeError('))
  ) {
    throw new Error(`${label}: missing non-empty outputs/ guard before archive export`);
  }

  const codeCells = nb.cells.filter((c) => c.cell_type === 'code');
  codeCells.forEach((cell, cellIdx) => {
    const srcLines = Array.isArray(cell.source) ? cell.source : String(cell.source || '').split('\n');
    const cleanPython = srcLines
      .map((line) => {
        const stripped = line.replace(/\r?\n$/, '');
        const trimmed = stripped.trimStart();
        if (trimmed.startsWith('!') || trimmed.startsWith('%')) {
          const indent = stripped.slice(0, stripped.length - trimmed.length);
          return `${indent}pass  # ipython magic stripped`;
        }
        return stripped;
      })
      .join('\n');

    const pyFile = path.join(tempPyDir, `nb_${index}_cell_${cellIdx}.py`);
    fs.writeFileSync(pyFile, cleanPython, 'utf8');
    execFileSync('python', ['-m', 'py_compile', pyFile], { stdio: 'pipe' });
  });
}

function validateMidiBinary(buf, label) {
  if (buf.subarray(0, 4).toString('ascii') !== 'MThd') {
    throw new Error(`${label}: MIDI file missing MThd header`);
  }
  let hasTempoMeta = false;
  for (let i = 0; i <= buf.length - 3; i++) {
    if (buf[i] === 0xff && buf[i + 1] === 0x51 && buf[i + 2] === 0x03) {
      hasTempoMeta = true;
      break;
    }
  }
  if (!hasTempoMeta) {
    throw new Error(`${label}: MIDI file missing FF 51 03 Set Tempo meta event`);
  }
}

function validatePlatformCharLimits(specMarkdown, label) {
  // Check Riffusion vibe limit (<= 120 chars)
  const riffMatch = specMarkdown.match(/### Vibe \/ Style Box[^\n]*\n```text\n([\s\S]*?)\n```/);
  if (riffMatch && riffMatch[1]) {
    const vibe = riffMatch[1].trim();
    if (vibe.length === 0 || vibe.length > 120) {
      throw new Error(`${label}: Riffusion Vibe prompt invalid length (${vibe.length})`);
    }
  }

  // Check Suno exclude list has no "no " prefix
  const exclMatch = specMarkdown.match(/### 3\. Exclude Styles Box[^\n]*\n```text\n([\s\S]*?)\n```/);
  if (exclMatch && exclMatch[1]) {
    if (/\bno\s+/i.test(exclMatch[1])) {
      throw new Error(`${label}: Suno exclude list contains forbidden "no " prefix: ${exclMatch[1]}`);
    }
  }

  // Check Mureka brief limit (<= 1024 chars)
  const murekaMatch = specMarkdown.match(/### Production Brief[^\n]*\n```text\n([\s\S]*?)\n```/);
  if (murekaMatch && murekaMatch[1]) {
    if (murekaMatch[1].trim().length > 1024) {
      throw new Error(`${label}: Mureka brief exceeds 1024 chars (${murekaMatch[1].trim().length})`);
    }
  }

  // Check Suno style limit (<= 1000 chars)
  const sunoStyleMatch = specMarkdown.match(/### 2\. Style of Music Box[^\n]*\n```text\n([\s\S]*?)\n```/);
  if (sunoStyleMatch && sunoStyleMatch[1]) {
    if (sunoStyleMatch[1].trim().length > 1000) {
      throw new Error(`${label}: Suno Style exceeds 1000 chars (${sunoStyleMatch[1].trim().length})`);
    }
  }
}

async function main() {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntk-music-verify-'));
  const tempPyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntk-pycompile-'));
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

  let nbCounter = 0;
  try {
    await waitForHttp(`${baseUrl}/api/dashboard`);

    // 1. Verify all 10 platforms in /api/packs/music-studio
    for (const platform of PLATFORMS) {
      const res = await postJson(baseUrl, '/api/packs/music-studio', {
        platform,
        mode: 'SINGLE_AUDIO_AND_VIDEO',
        cloudHost: platform === 'COLAB_KAGGLE_OPEN' ? 'KAGGLE' : 'COLAB',
        colabEngine: 'ACE_STEP_1_5',
        title: `Verify ${platform}`,
        theme: 'a rap music story about nigerian politics and resilience',
        genre: 'Boom-Bap / Afrobeats',
        mood: 'Urgent, Cinematic, Determined',
        bpm: 108,
        musicalKey: 'C minor',
        vocalMode: 'VOCAL',
        aspectRatio: '9:16',
        excludeTraits: 'no muffled bass, avoid distortion, flat snare',
      });

      const zip = await downloadZip(baseUrl, res.projectId);
      const midiEntry = zip.file('07_ace_studio_melody_guide.mid');
      if (!midiEntry) throw new Error(`${platform}: missing 07_ace_studio_melody_guide.mid`);
      validateMidiBinary(await midiEntry.async('nodebuffer'), platform);

      const specEntry = zip.file('01_COPY_PASTE_COMPLETE_WORKFLOW.md');
      if (!specEntry) throw new Error(`${platform}: missing 01_COPY_PASTE_COMPLETE_WORKFLOW.md`);
      validatePlatformCharLimits(await specEntry.async('string'), platform);

      const ipynbNames = Object.keys(zip.files).filter((f) => f.endsWith('.ipynb'));
      if (ipynbNames.length === 0) throw new Error(`${platform}: missing .ipynb notebook`);
      for (const nbName of ipynbNames) {
        const raw = await zip.file(nbName).async('string');
        validateNotebookAndCompilePython(raw, `${platform}/${nbName}`, tempPyDir, nbCounter++);
      }
      console.log(`PASS platform ZIP + MIDI + limits + py_compile: ${platform}`);
    }

    // 2. Verify ALBUM_STREAM_PACK + SCORE_FLOW_MOVIE (attached movie)
    const albumRes = await postJson(baseUrl, '/api/packs/music-studio', {
      platform: 'ALL_PLATFORMS_MASTER',
      mode: 'ALBUM_STREAM_PACK',
      title: 'Midnight Ledger EP',
      theme: 'Late night city hustle and financial freedom',
      trackCount: 4,
    });
    await downloadZip(baseUrl, albumRes.projectId);

    const outlineRes = await postJson(baseUrl, '/api/packs/flow-movie/outline', {
      format: 'ONE_OFF',
      aspectRatio: '16:9',
      runtimeMinutes: 2,
      outlineMode: 'ONE_LINE',
      idea: 'Courier races across rain-slicked bridges',
    });
    const movieRes = await postJson(baseUrl, '/api/packs/flow-movie', {
      format: 'ONE_OFF',
      aspectRatio: '16:9',
      runtimeMinutes: 2,
      outline: outlineRes.outline,
    });
    const scoreRes = await postJson(baseUrl, '/api/packs/music-studio', {
      platform: 'GOOGLE_FLOW',
      mode: 'SCORE_FLOW_MOVIE',
      title: 'Neon Courier Score',
      theme: 'Atmospheric synth score synced to scenes',
      attachedMovieProjectId: movieRes.projectId,
    });
    const scoreZip = await downloadZip(baseUrl, scoreRes.projectId);
    const cueText = await scoreZip.file('01_COPY_PASTE_COMPLETE_WORKFLOW.md')?.async('string');
    if (!cueText || !cueText.includes('Scene')) {
      throw new Error('SCORE_FLOW_MOVIE workflow missing movie scenes');
    }
    console.log('PASS ALBUM_STREAM_PACK + SCORE_FLOW_MOVIE cue linking');

    // 3. Verify all 4 Cloud GPU Lab templates (/api/packs/notebooks)
    for (const template of NOTEBOOK_TEMPLATES) {
      for (const cloud of ['COLAB', 'KAGGLE']) {
        const nbRes = await postJson(baseUrl, '/api/packs/notebooks', {
          template,
          platform: cloud,
          title: `CloudLab ${template} ${cloud}`,
          promptOrLyrics: 'a rap music story about resilience and rebuilding the city',
          bpmOrSpeed: '108',
          aspectRatio: '9:16',
        });
        const zip = await downloadZip(baseUrl, nbRes.projectId);
        const nbEntry = zip.file('notebook.ipynb');
        if (!nbEntry) throw new Error(`${template}/${cloud}: missing notebook.ipynb`);
        const raw = await nbEntry.async('string');
        validateNotebookAndCompilePython(raw, `CloudLab-${template}-${cloud}`, tempPyDir, nbCounter++);
      }
      console.log(`PASS Cloud GPU Lab (COLAB + KAGGLE py_compile & zero-stub): ${template}`);
    }

    console.log(`\nALL MUSIC STUDIO (10 PLATFORMS + 3 MODES) & 8 CLOUD GPU NOTEBOOKS PASSED!`);
  } finally {
    proc.kill();
    try {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
      fs.rmSync(tempPyDir, { recursive: true, force: true });
    } catch {
      // ignore Windows cleanup lock
    }
    if (logs && process.exitCode) {
      console.error('Server logs:\n', logs);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
