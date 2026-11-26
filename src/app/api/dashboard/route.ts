import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const [projectsCount, channelsCount, keysCount, healthyKeysCount, pausedJobs, recentProjects] =
    await Promise.all([
      prisma.project.count(),
      prisma.trackedChannel.count(),
      prisma.apiKeyRecord.count({ where: { enabled: true } }),
      prisma.apiKeyRecord.count({ where: { enabled: true, status: 'HEALTHY' } }),
      prisma.generationJob.findMany({
        where: { status: 'PAUSED_QUOTA' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

  return NextResponse.json({
    stats: {
      projectsCount,
      channelsCount,
      keysCount,
      healthyKeysCount,
      pausedJobsCount: pausedJobs.length,
    },
    pausedJobs,
    recentProjects,
  });
}
