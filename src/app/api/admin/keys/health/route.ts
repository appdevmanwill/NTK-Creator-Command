import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureRouterConfig } from '@/lib/ai-router/router';

export async function GET() {
  try {
    const [keys, cfg, recentLogs, pausedJobs] = await Promise.all([
      prisma.apiKeyRecord.findMany({
        where: { enabled: true },
        select: {
          id: true,
          label: true,
          provider: true,
          status: true,
          cooldownUntil: true,
          exhaustedUntil: true,
          totalRequests: true,
          totalFailures: true,
        },
      }),
      ensureRouterConfig(),
      prisma.failoverLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.generationJob.count({ where: { status: 'PAUSED_QUOTA' } }),
    ]);

    const now = Date.now();
    const healthy = keys.filter((k) => {
      if (k.status === 'HEALTHY') return true;
      if (k.status === 'COOLDOWN' && k.cooldownUntil && k.cooldownUntil.getTime() <= now) return true;
      if (k.status === 'EXHAUSTED_TODAY' && k.exhaustedUntil && k.exhaustedUntil.getTime() <= now) {
        return true;
      }
      return false;
    }).length;
    const cooldown = keys.filter(
      (k) => k.status === 'COOLDOWN' && (!k.cooldownUntil || k.cooldownUntil.getTime() > now)
    ).length;
    const exhausted = keys.filter(
      (k) => k.status === 'EXHAUSTED_TODAY' && (!k.exhaustedUntil || k.exhaustedUntil.getTime() > now)
    ).length;
    const invalid = keys.filter((k) => k.status === 'INVALID').length;

    return NextResponse.json({
      totalEnabled: keys.length,
      healthy,
      cooldown,
      exhausted,
      invalid,
      pausedJobs,
      rotationStrategy: cfg.rotationStrategy,
      zeroKeyFallbackEnabled: cfg.zeroKeyFallbackEnabled,
      activeFailover: recentLogs.length > 0 && recentLogs[0].toProvider !== null,
      lastFailover: recentLogs[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Health check error' },
      { status: 500 }
    );
  }
}
