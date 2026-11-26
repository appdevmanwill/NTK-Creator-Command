import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';

const ChatSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().min(1),
});

function extractChannelNames(text: string): string[] {
  const names = new Set<string>();
  const tagged = text.match(/\[CHANNEL:\s*([^\]]+)\]/gi) ?? [];
  for (const m of tagged) {
    const inner = m.replace(/^\[CHANNEL:\s*/i, '').replace(/\]$/, '').trim();
    if (inner) names.add(inner);
  }
  const bulletHandles = text.match(/@[A-Za-z0-9_]{3,28}/g) ?? [];
  for (const h of bulletHandles) {
    names.add(h.replace(/^@/, ''));
  }
  return Array.from(names).slice(0, 8);
}

export async function POST(req: NextRequest) {
  try {
    const body = ChatSchema.parse(await req.json());
    const thread = body.threadId
      ? await prisma.chatThread.findUnique({ where: { id: body.threadId } })
      : null;

    const activeThread =
      thread ??
      (await prisma.chatThread.create({
        data: { title: body.message.slice(0, 56) },
      }));

    await prisma.chatMessage.create({
      data: {
        threadId: activeThread.id,
        role: 'user',
        content: body.message,
      },
    });

    const history = await prisma.chatMessage.findMany({
      where: { threadId: activeThread.id },
      orderBy: { createdAt: 'asc' },
      take: 12,
    });

    const convoContext = history
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    let replyText = '';
    let providerUsed = 'ROUTER';
    let modelUsed = 'auto';

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        systemPrompt: `You are the NTK Viral Hook & Digital Product Coach.
Help creators pick high-CPM evergreen niches, punchy curiosity-gap hooks, digital product ideas ($7-$25 ebooks, spreadsheets, planners), and memorable channel names.
Whenever you suggest YouTube channel names, wrap each suggested name like [CHANNEL: NameHere] so the UI automatically renders Check YouTube Availability buttons.`,
        prompt: convoContext,
        maxOutputTokens: 2500,
      });
      replyText = res.text;
      providerUsed = res.provider;
      modelUsed = res.model;
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        replyText = `All AI keys are temporarily in cooldown. Here is your copy-paste Zero-Key Prompt:\n\n${buildZeroKeyMetaPrompt(
          'Viral Hook Coach',
          body.message
        )}`;
        providerUsed = 'ZERO_KEY';
        modelUsed = 'manual';
      } else {
        throw err;
      }
    }

    const savedAssistant = await prisma.chatMessage.create({
      data: {
        threadId: activeThread.id,
        role: 'assistant',
        content: replyText,
        providerUsed,
        modelUsed,
      },
    });

    await prisma.chatThread.update({
      where: { id: activeThread.id },
      data: { updatedAt: new Date() },
    });

    const suggestedChannels = extractChannelNames(replyText);

    return NextResponse.json({
      threadId: activeThread.id,
      message: savedAssistant,
      suggestedChannels,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Coach chat failed' },
      { status: 400 }
    );
  }
}
