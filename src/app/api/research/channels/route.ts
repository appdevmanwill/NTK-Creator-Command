import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const CreateChannelSchema = z.object({
  name: z.string().min(1),
  handle: z.string().min(1),
  url: z.string().url(),
  niche: z.string().default('Money & Finance'),
  videoStyle: z.string().default('Stickman'),
  subscribers: z.number().int().min(0).default(0),
  uploadsPerWeek: z.number().min(0).default(2),
  avgLengthMin: z.number().min(0).default(10),
  startedDate: z.string().default(new Date().toISOString().slice(0, 10)),
  estMonthlyViews: z.number().int().min(0).default(50000),
  estMonthlyAdSense: z.number().min(0).default(250),
  monetizationConfirmed: z.boolean().default(false),
  sellsDigitalProducts: z.boolean().default(false),
  digitalProductUrl: z.string().optional().nullable(),
  digitalProductType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const niche = req.nextUrl.searchParams.get('niche') ?? 'ALL';
  const style = req.nextUrl.searchParams.get('style') ?? 'ALL';
  const monetizedOnly = req.nextUrl.searchParams.get('monetized') === 'true';
  const startedThisYear = req.nextUrl.searchParams.get('thisYear') === 'true';
  const sellsProductsOnly = req.nextUrl.searchParams.get('digitalProducts') === 'true';
  const sort = req.nextUrl.searchParams.get('sort') ?? 'earnings';

  const currentYear = String(new Date().getFullYear());
  const all = await prisma.trackedChannel.findMany();

  const filtered = all.filter((c) => {
    if (niche !== 'ALL' && c.niche !== niche) return false;
    if (style !== 'ALL' && c.videoStyle !== style) return false;
    if (monetizedOnly && !c.monetizationConfirmed) return false;
    if (startedThisYear && !c.startedDate.startsWith(currentYear)) return false;
    if (sellsProductsOnly && !c.sellsDigitalProducts) return false;
    if (q) {
      const hay = `${c.name} ${c.handle} ${c.niche} ${c.videoStyle} ${c.digitalProductType ?? ''} ${c.notes ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === 'subscribers') return b.subscribers - a.subscribers;
    if (sort === 'views') return b.estMonthlyViews - a.estMonthlyViews;
    if (sort === 'newest') return b.startedDate.localeCompare(a.startedDate);
    return b.estMonthlyAdSense - a.estMonthlyAdSense;
  });

  // Niche benchmark summary cards
  const nicheGroups: Record<string, { count: number; totalAdSense: number; digitalProductCount: number }> = {};
  for (const c of all) {
    if (!nicheGroups[c.niche]) {
      nicheGroups[c.niche] = { count: 0, totalAdSense: 0, digitalProductCount: 0 };
    }
    nicheGroups[c.niche].count++;
    nicheGroups[c.niche].totalAdSense += c.estMonthlyAdSense;
    if (c.sellsDigitalProducts) nicheGroups[c.niche].digitalProductCount++;
  }

  const benchmarks = Object.entries(nicheGroups).map(([nicheName, stat]) => ({
    niche: nicheName,
    channels: stat.count,
    avgMonthlyAdSense: Math.round(stat.totalAdSense / Math.max(1, stat.count)),
    digitalProductRate: Math.round((stat.digitalProductCount / Math.max(1, stat.count)) * 100),
  }));

  return NextResponse.json({
    channels: filtered,
    totalInDb: all.length,
    benchmarks,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateChannelSchema.parse(await req.json());
    const channel = await prisma.trackedChannel.upsert({
      where: { url: body.url },
      update: body,
      create: body,
    });
    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save channel' },
      { status: 400 }
    );
  }
}
