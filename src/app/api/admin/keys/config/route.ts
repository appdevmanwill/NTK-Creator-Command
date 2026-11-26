import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { ensureRouterConfig } from '@/lib/ai-router/router';

const PatchConfigSchema = z.object({
  rotationStrategy: z.enum(['PRIORITY_FAILOVER', 'ROUND_ROBIN']).optional(),
  zeroKeyFallbackEnabled: z.boolean().optional(),
  taskRouting: z.record(z.array(z.enum(['GEMINI', 'GROQ', 'OPENROUTER', 'CUSTOM']))).optional(),
});

export async function GET() {
  const cfg = await ensureRouterConfig();
  return NextResponse.json({
    rotationStrategy: cfg.rotationStrategy,
    zeroKeyFallbackEnabled: cfg.zeroKeyFallbackEnabled,
    taskRouting: JSON.parse(cfg.taskRoutingJson || '{}'),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = PatchConfigSchema.parse(await req.json());
    await ensureRouterConfig();
    const updated = await prisma.routerConfig.update({
      where: { id: 'default' },
      data: {
        ...(body.rotationStrategy ? { rotationStrategy: body.rotationStrategy } : {}),
        ...(body.zeroKeyFallbackEnabled !== undefined
          ? { zeroKeyFallbackEnabled: body.zeroKeyFallbackEnabled }
          : {}),
        ...(body.taskRouting ? { taskRoutingJson: JSON.stringify(body.taskRouting) } : {}),
      },
    });
    return NextResponse.json({
      rotationStrategy: updated.rotationStrategy,
      zeroKeyFallbackEnabled: updated.zeroKeyFallbackEnabled,
      taskRouting: JSON.parse(updated.taskRoutingJson || '{}'),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid router config' },
      { status: 400 }
    );
  }
}
