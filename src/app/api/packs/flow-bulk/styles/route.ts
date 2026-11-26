import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const SaveStyleSchema = z.object({
  name: z.string().min(1),
  sourceReference: z.string().default('Custom'),
  styleHeader: z.string().min(1),
  palette: z.array(z.string()).default([]),
});

export async function GET() {
  const styles = await prisma.savedFlowStyle.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ styles });
}

export async function POST(req: NextRequest) {
  try {
    const body = SaveStyleSchema.parse(await req.json());
    const saved = await prisma.savedFlowStyle.create({
      data: {
        name: body.name,
        sourceReference: body.sourceReference,
        styleHeader: body.styleHeader,
        paletteJson: JSON.stringify(body.palette),
      },
    });
    return NextResponse.json({ style: saved }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save style' },
      { status: 400 }
    );
  }
}
