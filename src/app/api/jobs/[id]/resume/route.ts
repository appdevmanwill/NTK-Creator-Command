import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = await prisma.generationJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  const updated = await prisma.generationJob.update({
    where: { id },
    data: { status: 'PENDING', lastError: null },
  });
  return NextResponse.json({
    job: updated,
    message: 'Job marked ready to resume from its saved checkpoint inside the studio module.',
  });
}
