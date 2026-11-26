import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { encryptApiKey } from '@/lib/ai-router/crypto';

const PatchKeySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  baseUrl: z.string().optional().nullable(),
  defaultModel: z.string().optional().nullable(),
  apiKey: z.string().min(8).optional(),
  resetStatus: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = PatchKeySchema.parse(await req.json());
    const data: Record<string, unknown> = {};

    if (body.label !== undefined) data.label = body.label;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl?.trim() || null;
    if (body.defaultModel !== undefined) data.defaultModel = body.defaultModel?.trim() || null;
    if (body.resetStatus) {
      data.status = 'HEALTHY';
      data.cooldownUntil = null;
      data.exhaustedUntil = null;
      data.modelHealthJson = '{}';
      data.lastError = null;
    }
    if (body.apiKey) {
      const enc = encryptApiKey(body.apiKey);
      data.encryptedKey = enc.encryptedKey;
      data.iv = enc.iv;
      data.authTag = enc.authTag;
      data.keyHash = enc.keyHash;
      data.maskedKey = enc.maskedKey;
      data.status = 'HEALTHY';
      data.cooldownUntil = null;
      data.exhaustedUntil = null;
      data.lastError = null;
    }

    const updated = await prisma.apiKeyRecord.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      key: {
        id: updated.id,
        label: updated.label,
        provider: updated.provider,
        maskedKey: updated.maskedKey,
        status: updated.status,
        enabled: updated.enabled,
        priority: updated.priority,
        defaultModel: updated.defaultModel,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update key' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.apiKeyRecord.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete key' },
      { status: 400 }
    );
  }
}
