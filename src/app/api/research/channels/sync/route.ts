import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { decryptApiKey } from '@/lib/ai-router/crypto';
import { sanitizeExternalUrl } from '@/lib/utils';

const SyncSchema = z.object({
  channelId: z.string().optional(),
  urlOrHandle: z.string().optional(),
});

const STORE_DOMAINS = ['gumroad.com', 'payhip.com', 'myshopify.com', 'selar.com', 'stan.store', 'whop.com'];

function detectStoreLinks(text: string): { foundUrl: string | null; productType: string | null } {
  const urlMatches = text.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
  for (const u of urlMatches) {
    const lower = u.toLowerCase();
    if (STORE_DOMAINS.some((d) => lower.includes(d))) {
      const productType = lower.includes('selar')
        ? 'Selar Digital Product'
        : lower.includes('payhip')
        ? 'Payhip Digital Store'
        : lower.includes('gumroad')
        ? 'Gumroad Digital Product'
        : lower.includes('stan.store')
        ? 'Stan Store Offer'
        : lower.includes('whop')
        ? 'Whop Community / Pack'
        : 'Shopify Store';
      return { foundUrl: u, productType };
    }
  }
  return { foundUrl: null, productType: null };
}

export async function POST(req: NextRequest) {
  try {
    const body = SyncSchema.parse(await req.json());
    const existing = body.channelId
      ? await prisma.trackedChannel.findUnique({ where: { id: body.channelId } })
      : null;

    let targetUrl = existing?.url || body.urlOrHandle?.trim() || '';
    if (!targetUrl) {
      return NextResponse.json({ error: 'Channel ID or URL/handle required' }, { status: 400 });
    }
    if (targetUrl.startsWith('@')) {
      targetUrl = `https://www.youtube.com/${targetUrl}`;
    } else if (!targetUrl.startsWith('http')) {
      targetUrl = `https://www.youtube.com/@${targetUrl.replace(/^@/, '')}`;
    }

    const safeUrl = sanitizeExternalUrl(targetUrl);

    // Check if free YouTube Data API v3 key exists in Vault
    const ytKeyRec = await prisma.apiKeyRecord.findFirst({
      where: { provider: 'YOUTUBE', enabled: true, status: { not: 'INVALID' } },
      orderBy: { priority: 'asc' },
    });

    let channelTitle = existing?.name || safeUrl.pathname.replace(/^\//, '') || 'Tracked Channel';
    let subscribers = existing?.subscribers ?? 0;
    let descriptionText = '';
    let syncSource = 'Page Metadata Fetch';

    if (ytKeyRec) {
      const apiKey = decryptApiKey(ytKeyRec);
      const handleMatch = safeUrl.pathname.match(/\/@([A-Za-z0-9_.-]+)/);
      const queryParam = handleMatch
        ? `forHandle=${encodeURIComponent('@' + handleMatch[1])}`
        : `forUsername=${encodeURIComponent(channelTitle.replace(/^@/, ''))}`;
      const ytResp = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${queryParam}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (ytResp.ok) {
        const ytData = (await ytResp.json()) as {
          items?: Array<{
            snippet?: { title?: string; description?: string };
            statistics?: { subscriberCount?: string; viewCount?: string };
          }>;
        };
        const item = ytData.items?.[0];
        if (item) {
          channelTitle = item.snippet?.title || channelTitle;
          descriptionText = item.snippet?.description || '';
          subscribers = Number(item.statistics?.subscriberCount ?? subscribers) || subscribers;
          syncSource = 'YouTube Data API v3';
        }
      }
    }

    if (!descriptionText) {
      try {
        const htmlResp = await fetch(safeUrl.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 NTKCreatorCommand/1.0' },
          signal: AbortSignal.timeout(12000),
        });
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          const tMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (tMatch?.[1]) channelTitle = tMatch[1].replace(/\s*-\s*YouTube$/i, '').trim();
          descriptionText = html.slice(0, 60000);
        }
      } catch {
        // graceful fallback
      }
    }

    const detected = detectStoreLinks(descriptionText);

    if (existing) {
      const updated = await prisma.trackedChannel.update({
        where: { id: existing.id },
        data: {
          name: channelTitle,
          subscribers,
          sellsDigitalProducts: detected.foundUrl ? true : existing.sellsDigitalProducts,
          digitalProductUrl: detected.foundUrl || existing.digitalProductUrl,
          digitalProductType: detected.productType || existing.digitalProductType,
          lastSyncedAt: new Date(),
        },
      });
      return NextResponse.json({ channel: updated, syncSource });
    }

    const handle = safeUrl.pathname.includes('@')
      ? '@' + safeUrl.pathname.split('@')[1].split('/')[0]
      : '@' + channelTitle.toLowerCase().replace(/[^a-z0-9]+/g, '');

    const created = await prisma.trackedChannel.upsert({
      where: { url: safeUrl.toString() },
      update: {
        name: channelTitle,
        subscribers,
        sellsDigitalProducts: Boolean(detected.foundUrl),
        digitalProductUrl: detected.foundUrl,
        digitalProductType: detected.productType,
        lastSyncedAt: new Date(),
      },
      create: {
        name: channelTitle,
        handle,
        url: safeUrl.toString(),
        niche: 'Money & Finance',
        videoStyle: 'Animated',
        subscribers,
        uploadsPerWeek: 2,
        avgLengthMin: 10,
        startedDate: new Date().toISOString().slice(0, 10),
        estMonthlyViews: Math.max(15000, subscribers * 3),
        estMonthlyAdSense: Math.max(80, Math.round((subscribers * 3) / 1000 * 4)),
        monetizationConfirmed: subscribers >= 1000,
        sellsDigitalProducts: Boolean(detected.foundUrl),
        digitalProductUrl: detected.foundUrl,
        digitalProductType: detected.productType,
        notes: `Added via ${syncSource}`,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ channel: created, syncSource });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Channel sync failed' },
      { status: 400 }
    );
  }
}
