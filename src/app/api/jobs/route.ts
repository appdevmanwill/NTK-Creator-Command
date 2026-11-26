import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const jobs = await prisma.generationJob.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 40,
  });
  return NextResponse.json({ jobs });
}
