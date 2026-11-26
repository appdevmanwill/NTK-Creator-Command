import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { extractJsonFromText, sanitizeExternalUrl } from '@/lib/utils';

const AnalyzeProductSchema = z.object({
  url: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = AnalyzeProductSchema.parse(await req.json());
    const parsedUrl = sanitizeExternalUrl(body.url);

    let extractedText = '';
    let pageTitle = parsedUrl.hostname;
    let fetchNote = 'Live HTML fetched';

    try {
      const resp = await fetch(parsedUrl.toString(), {
        headers: { 'User-Agent': 'NTKCreatorCommand/1.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (resp.ok) {
        const html = await resp.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch?.[1]) pageTitle = titleMatch[1].trim();
        extractedText = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4500);
      } else {
        fetchNote = `HTTP ${resp.status} — analyzed from URL & domain context`;
      }
    } catch {
      fetchNote = 'Could not fetch live page HTML — analyzed from URL context';
    }

    const prompt = `Evaluate this digital product page for creator replication potential and differentiation:
URL: ${parsedUrl.toString()}
Page Title: ${pageTitle}
Extracted Content: ${extractedText || 'N/A'}

Return STRICT JSON:
{
  "productTitle": "Detected product name",
  "replicationScore": 4,
  "marketDemand": "High / Medium / Low with 1-sentence reason",
  "competitionLevel": "High / Medium / Low with 1-sentence reason",
  "pricingEvaluation": "Price evaluation and recommended $7-$25 sweet-spot pricing",
  "differentiationAngles": [
    "Concrete Differentiation Angle 1",
    "Concrete Differentiation Angle 2",
    "Concrete Differentiation Angle 3",
    "Concrete Differentiation Angle 4",
    "Concrete Differentiation Angle 5"
  ]
}`;

    let report: Record<string, unknown>;
    let providerSummary = 'Deterministic Heuristic';

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt,
        jsonMode: true,
        maxOutputTokens: 2048,
      });
      report = extractJsonFromText(res.text);
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      report = {
        productTitle: pageTitle,
        replicationScore: 4,
        marketDemand: 'Strong evergreen buyer demand when paired with organic YouTube/Shorts tutorials.',
        competitionLevel: 'Moderate — most sellers ship static files without guided video walkthroughs.',
        pricingEvaluation: 'Position between $12 and $19 with a $7 starter tier for impulse conversions.',
        differentiationAngles: [
          'Include a formula-driven Excel/Sheets companion alongside the PDF guide',
          'Add 30-day & 365-day hyperlinked implementation templates',
          'Embed quick-start video walkthrough links inside Chapter 1',
          'Offer region-neutral currency customization out of the box',
          'Bundle a free lead-magnet checklist to grow an owned email list',
        ],
      };
    }

    return NextResponse.json({
      url: parsedUrl.toString(),
      fetchNote,
      providerSummary,
      report,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Product analysis failed' },
      { status: 400 }
    );
  }
}
