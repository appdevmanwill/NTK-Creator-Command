import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const threads = await prisma.chatThread.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
    take: 30,
  });
  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const thread = await prisma.chatThread.create({
    data: {
      title: body.title?.trim() || 'Viral Hook & Niche Session',
    },
    include: { messages: true },
  });
  return NextResponse.json({ thread }, { status: 201 });
}
