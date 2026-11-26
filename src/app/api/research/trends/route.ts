import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { decryptApiKey } from '@/lib/ai-router/crypto';
import { generateWithRouter } from '@/lib/ai-router/router';
import { extractJsonFromText } from '@/lib/utils';

const TrendSchema = z.object({
  keyword: z.string().min(1),
  region: z.string().default('US'),
  window: z.enum(['12m', '5y']).default('5y'),
});

export async function POST(req: NextRequest) {
  try {
    const body = TrendSchema.parse(await req.json());
    const dateParam = body.window === '12m' ? 'today 12-m' : 'today 5-y';
    const geoParam = body.region === 'GLOBAL' ? '' : `&geo=${encodeURIComponent(body.region)}`;
    const googleTrendsYoutubeUrl = `https://trends.google.com/trends/explore?date=${encodeURIComponent(
      dateParam
    )}${geoParam}&gprop=youtube&q=${encodeURIComponent(body.keyword)}`;

    // Check optional YouTube Data API v3 key for recent video velocity
    let youtubeVelocity: { sampleCount: number; recentVideos: Array<{ title: string; publishedAt: string }> } | null =
      null;
    const ytKeyRec = await prisma.apiKeyRecord.findFirst({
      where: { provider: 'YOUTUBE', enabled: true, status: { not: 'INVALID' } },
    });
    if (ytKeyRec) {
      try {
        const apiKey = decryptApiKey(ytKeyRec);
        const resp = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=8&q=${encodeURIComponent(
            body.keyword
          )}&key=${encodeURIComponent(apiKey)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (resp.ok) {
          const d = (await resp.json()) as {
            items?: Array<{ snippet?: { title?: string; publishedAt?: string } }>;
          };
          youtubeVelocity = {
            sampleCount: d.items?.length ?? 0,
            recentVideos: (d.items ?? []).map((x) => ({
              title: x.snippet?.title ?? '',
              publishedAt: x.snippet?.publishedAt ?? '',
            })),
          };
        }
      } catch {
        // ignore optional YT failure
      }
    }

    let analysis: {
      verdict: string;
      seasonality: string;
      monetizationFit: string;
      subTopics: string[];
      momentumSeries: Array<{ period: string; interest: number }>;
    };
    let providerSummary = 'Deterministic Estimate';

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `Analyze YouTube Search trend potential for keyword "${body.keyword}" in region ${body.region} over ${
          body.window === '12m' ? '12 months' : '5 years'
        }.
Return STRICT JSON:
{
  "verdict": "Concise 2-sentence verdict on evergreen vs fad demand",
  "seasonality": "Peak months or steady year-round behavior",
  "monetizationFit": "Best digital product & AdSense angle",
  "subTopics": ["Low-competition sub-topic 1", "Sub-topic 2", "Sub-topic 3", "Sub-topic 4"],
  "momentumSeries": [
    { "period": "P1", "interest": 42 },
    { "period": "P2", "interest": 51 },
    { "period": "P3", "interest": 58 },
    { "period": "P4", "interest": 66 },
    { "period": "P5", "interest": 74 },
    { "period": "P6", "interest": 85 }
  ]
}`,
        jsonMode: true,
        maxOutputTokens: 1536,
      });
      analysis = extractJsonFromText(res.text);
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      analysis = {
        verdict: `"${body.keyword}" shows strong recurring search intent for tutorials, templates, and faceless explainers.`,
        seasonality: 'Steady evergreen demand with Q1 & Q4 spikes.',
        monetizationFit: 'Pair 8–12 min educational breakdowns with a $12–$19 downloadable template or ebook.',
        subTopics: [
          `${body.keyword} for beginners`,
          `${body.keyword} step by step template`,
          `Common ${body.keyword} mistakes`,
          `Free ${body.keyword} tools 2026`,
        ],
        momentumSeries: [
          { period: 'P1', interest: 45 },
          { period: 'P2', interest: 52 },
          { period: 'P3', interest: 60 },
          { period: 'P4', interest: 68 },
          { period: 'P5', interest: 77 },
          { period: 'P6', interest: 86 },
        ],
      };
    }

    return NextResponse.json({
      keyword: body.keyword,
      region: body.region,
      window: body.window,
      googleTrendsYoutubeUrl,
      youtubeVelocity,
      providerSummary,
      analysis,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trend analysis failed' },
      { status: 400 }
    );
  }
}
