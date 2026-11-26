import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { resolveFilesDir } from '@/lib/paths';
import { PROVIDER_CAPABILITY_DEFAULTS, PROVIDER_MODEL_CHAINS } from './catalog';
import { encryptApiKey } from './crypto';
import { ProviderType } from './types';

export interface ParsedKeyCandidate {
  label: string;
  provider: ProviderType;
  rawKey: string;
  baseUrl?: string;
  sourceFile: string;
}

export interface KeyImportSummary {
  scannedFiles: string[];
  imported: number;
  skippedExisting: number;
  entries: Array<{ label: string; provider: ProviderType; maskedKey: string; action: 'imported' | 'existing' }>;
}

function resolveFilesDirectory(): string | null {
  return resolveFilesDir();
}

function inferProvider(hint: string, keyValue: string): ProviderType {
  const h = hint.toLowerCase();
  const k = keyValue.trim();

  if (h.includes('youtube') || h.includes('yt_')) return 'YOUTUBE';
  if (k.startsWith('gsk_') || h.includes('groq')) return 'GROQ';
  if (k.startsWith('sk-or-') || h.includes('openrouter')) return 'OPENROUTER';
  if (k.startsWith('AQ.') || k.startsWith('AIza') || h.includes('gemini') || h.includes('google')) {
    return 'GEMINI';
  }
  if (h.includes('custom') || h.includes('openai')) return 'CUSTOM';
  return 'GEMINI';
}

function looksLikeKeyToken(token: string): boolean {
  const t = token.trim().replace(/^["']|["']$/g, '');
  if (t.length < 20) return false;
  if (/\s/.test(t)) return false;
  if (t.startsWith('http://') || t.startsWith('https://')) return false;
  return /^[A-Za-z0-9_\-\.]+$/.test(t);
}

export function parseKeysFromText(content: string, sourceFile: string): ParsedKeyCandidate[] {
  const results: ParsedKeyCandidate[] = [];
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));

  let pendingLabel = '';

  for (const line of lines) {
    // Pattern 1: KEY=VALUE or Label: KEY
    const kvMatch = line.match(/^([A-Za-z0-9 _\-\/()]+?)\s*[:=]\s*(.+)$/);
    if (kvMatch) {
      const left = kvMatch[1].trim();
      const right = kvMatch[2].trim().replace(/^["']|["']$/g, '');
      if (looksLikeKeyToken(right)) {
        const provider = inferProvider(left, right);
        results.push({
          label: left || `${provider} Key`,
          provider,
          rawKey: right,
          sourceFile,
        });
        pendingLabel = '';
        continue;
      }
    }

    // Pattern 2: Standalone key token on its own line (optionally preceded by a label line)
    if (looksLikeKeyToken(line)) {
      const provider = inferProvider(pendingLabel, line);
      results.push({
        label: pendingLabel ? `${pendingLabel} (FILES)` : `${provider} Key (FILES)`,
        provider,
        rawKey: line,
        sourceFile,
      });
      pendingLabel = '';
      continue;
    }

    // Otherwise treat short descriptive line as pending label for the next line
    pendingLabel = line.replace(/[:\-]+$/, '').trim();
  }

  return results;
}

export async function importKeysFromFilesFolder(): Promise<KeyImportSummary> {
  const dir = resolveFilesDirectory();
  if (!dir) {
    return { scannedFiles: [], imported: 0, skippedExisting: 0, entries: [] };
  }

  const allFiles = fs.readdirSync(dir);
  const keyFiles = allFiles.filter((name) => {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) return false;
    return /api[-_\s]*keys?/i.test(name) || /\.(txt|md|env)$/i.test(name);
  });

  // Sort so files explicitly named "api keys*" come first
  keyFiles.sort((a, b) => {
    const aMatch = /api[-_\s]*keys?/i.test(a) ? 0 : 1;
    const bMatch = /api[-_\s]*keys?/i.test(b) ? 0 : 1;
    return aMatch - bMatch || a.localeCompare(b);
  });

  const scannedFiles: string[] = [];
  const entries: KeyImportSummary['entries'] = [];
  let imported = 0;
  let skippedExisting = 0;

  for (const fileName of keyFiles) {
    const fullPath = path.join(dir, fileName);
    const content = fs.readFileSync(fullPath, 'utf8');
    const parsed = parseKeysFromText(content, fileName);
    if (parsed.length === 0) continue;

    scannedFiles.push(fileName);
    for (const candidate of parsed) {
      const enc = encryptApiKey(candidate.rawKey);
      const existing = await prisma.apiKeyRecord.findUnique({
        where: { keyHash: enc.keyHash },
      });

      if (existing) {
        skippedExisting++;
        entries.push({
          label: existing.label,
          provider: existing.provider as ProviderType,
          maskedKey: existing.maskedKey,
          action: 'existing',
        });
        continue;
      }

      const defaultModels = PROVIDER_MODEL_CHAINS[candidate.provider];
      const caps = PROVIDER_CAPABILITY_DEFAULTS[candidate.provider];

      await prisma.apiKeyRecord.create({
        data: {
          label: candidate.label,
          provider: candidate.provider,
          encryptedKey: enc.encryptedKey,
          iv: enc.iv,
          authTag: enc.authTag,
          keyHash: enc.keyHash,
          maskedKey: enc.maskedKey,
          baseUrl: candidate.baseUrl ?? null,
          defaultModel: defaultModels[0] ?? null,
          enabled: true,
          priority: candidate.provider === 'GEMINI' ? 10 : 20,
          capabilitiesJson: JSON.stringify(caps),
          status: 'HEALTHY',
        },
      });

      imported++;
      entries.push({
        label: candidate.label,
        provider: candidate.provider,
        maskedKey: enc.maskedKey,
        action: 'imported',
      });
    }
  }

  return { scannedFiles, imported, skippedExisting, entries };
}
