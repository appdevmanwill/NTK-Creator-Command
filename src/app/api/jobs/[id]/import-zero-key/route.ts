import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractJsonFromText } from '@/lib/utils';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as { pastedOutput?: string };
    const job = await prisma.generationJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!body.pastedOutput?.trim()) {
      return NextResponse.json({ error: 'Pasted Zero-Key output is required' }, { status: 400 });
    }

    let state: Record<string, unknown> = {};
    try {
      state = JSON.parse(job.checkpointStateJson) as Record<string, unknown>;
    } catch {
      state = {};
    }

    let parsedPayload: unknown = body.pastedOutput.trim();
    try {
      parsedPayload = extractJsonFromText(body.pastedOutput);
    } catch {
      // Keep raw markdown text if not JSON
    }

    state.zeroKeyImportedOutput = parsedPayload;
    const updated = await prisma.generationJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedSteps: job.totalSteps,
        checkpointStateJson: JSON.stringify(state),
        lastProviderUsed: 'ZERO_KEY_IMPORT',
        lastError: null,
      },
    });

    return NextResponse.json({ job: updated, parsedPayload });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to import Zero-Key response' },
      { status: 400 }
    );
  }
}
