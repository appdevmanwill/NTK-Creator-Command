import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { PROVIDER_CAPABILITY_DEFAULTS, PROVIDER_MODEL_CHAINS } from '@/lib/ai-router/catalog';
import { encryptApiKey } from '@/lib/ai-router/crypto';
import { ensureRouterConfig } from '@/lib/ai-router/router';
import { ProviderType } from '@/lib/ai-router/types';

const CreateKeySchema = z.object({
  label: z.string().min(1).max(120),
  provider: z.enum(['GEMINI', 'GROQ', 'OPENROUTER', 'CUSTOM', 'YOUTUBE']),
  apiKey: z.string().min(8),
  baseUrl: z.string().optional().nullable(),
  defaultModel: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(1000).optional(),
  enabled: z.boolean().optional(),
  capabilities: z
    .object({
      text: z.boolean().optional(),
      vision: z.boolean().optional(),
      long_context: z.boolean().optional(),
      json: z.boolean().optional(),
      audio: z.boolean().optional(),
    })
    .optional(),
});

function sanitizeRecord(r: {
  id: string;
  label: string;
  provider: string;
  maskedKey: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  priority: number;
  capabilitiesJson: string;
  status: string;
  cooldownUntil: Date | null;
  exhaustedUntil: Date | null;
  modelHealthJson: string;
  totalRequests: number;
  totalFailures: number;
  lastError: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    label: r.label,
    provider: r.provider,
    maskedKey: r.maskedKey,
    baseUrl: r.baseUrl,
    defaultModel: r.defaultModel,
    enabled: r.enabled,
    priority: r.priority,
    capabilities: JSON.parse(r.capabilitiesJson || '{}'),
    status: r.status,
    cooldownUntil: r.cooldownUntil,
    exhaustedUntil: r.exhaustedUntil,
    modelHealth: JSON.parse(r.modelHealthJson || '{}'),
    totalRequests: r.totalRequests,
    totalFailures: r.totalFailures,
    lastError: r.lastError,
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function GET() {
  try {
    const [keys, config, logs] = await Promise.all([
      prisma.apiKeyRecord.findMany({ orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] }),
      ensureRouterConfig(),
      prisma.failoverLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);
    return NextResponse.json({
      keys: keys.map(sanitizeRecord),
      config: {
        rotationStrategy: config.rotationStrategy,
        zeroKeyFallbackEnabled: config.zeroKeyFallbackEnabled,
        taskRouting: JSON.parse(config.taskRoutingJson || '{}'),
      },
      failoverLogs: logs,
      providerChains: PROVIDER_MODEL_CHAINS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load keys' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateKeySchema.parse(await req.json());
    const enc = encryptApiKey(body.apiKey);
    const provider = body.provider as ProviderType;
    const defaultCaps = PROVIDER_CAPABILITY_DEFAULTS[provider];
    const mergedCaps = { ...defaultCaps, ...(body.capabilities ?? {}) };
    const defaultModel = body.defaultModel?.trim() || PROVIDER_MODEL_CHAINS[provider][0] || null;

    const existing = await prisma.apiKeyRecord.findUnique({ where: { keyHash: enc.keyHash } });
    if (existing) {
      const updated = await prisma.apiKeyRecord.update({
        where: { id: existing.id },
        data: {
          label: body.label,
          provider,
          baseUrl: body.baseUrl?.trim() || existing.baseUrl,
          defaultModel,
          priority: body.priority ?? existing.priority,
          enabled: body.enabled ?? true,
          capabilitiesJson: JSON.stringify(mergedCaps),
          status: 'HEALTHY',
          cooldownUntil: null,
          exhaustedUntil: null,
          lastError: null,
        },
      });
      return NextResponse.json({ key: sanitizeRecord(updated), deduplicated: true });
    }

    const created = await prisma.apiKeyRecord.create({
      data: {
        label: body.label,
        provider,
        encryptedKey: enc.encryptedKey,
        iv: enc.iv,
        authTag: enc.authTag,
        keyHash: enc.keyHash,
        maskedKey: enc.maskedKey,
        baseUrl: body.baseUrl?.trim() || null,
        defaultModel,
        priority: body.priority ?? 100,
        enabled: body.enabled ?? true,
        capabilitiesJson: JSON.stringify(mergedCaps),
        status: 'HEALTHY',
      },
    });
    return NextResponse.json({ key: sanitizeRecord(created) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid key payload' },
      { status: 400 }
    );
  }
}
