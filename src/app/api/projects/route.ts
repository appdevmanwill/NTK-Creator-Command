import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();

  const projects = await prisma.project.findMany({
    where: type && type !== 'ALL' ? { type } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const filtered = q
    ? projects.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.metadataJson.toLowerCase().includes(q)
      )
    : projects;

  return NextResponse.json({ projects: filtered });
}
