import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { extractJsonFromText, sanitizeExternalUrl } from '@/lib/utils';

const AnalyzeStoreSchema = z.object({
  url: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = AnalyzeStoreSchema.parse(await req.json());
    const parsedUrl = sanitizeExternalUrl(body.url);
    const origin = parsedUrl.origin;

    let isShopify = false;
    let products: Array<{ title: string; product_type: string; price: number }> = [];
    let pageTitle = parsedUrl.hostname;
    let metaDescription = '';

    // 1. Try Shopify public /products.json
    try {
      const pjResp = await fetch(`${origin}/products.json?limit=250`, {
        headers: { 'User-Agent': 'NTKCreatorCommand/1.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (pjResp.ok) {
        const data = (await pjResp.json()) as {
          products?: Array<{
            title?: string;
            product_type?: string;
            variants?: Array<{ price?: string }>;
          }>;
        };
        if (Array.isArray(data.products) && data.products.length > 0) {
          isShopify = true;
          products = data.products.map((p) => ({
            title: p.title || 'Untitled',
            product_type: p.product_type || 'General',
            price: Number(p.variants?.[0]?.price ?? 0) || 0,
          }));
        }
      }
    } catch {
      // Fall back to homepage HTML inspection
    }

    // 2. Fetch homepage metadata
    try {
      const homeResp = await fetch(parsedUrl.toString(), {
        headers: { 'User-Agent': 'NTKCreatorCommand/1.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (homeResp.ok) {
        const html = await homeResp.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch?.[1]) pageTitle = titleMatch[1].trim();
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        if (descMatch?.[1]) metaDescription = descMatch[1].trim();
      }
    } catch {
      // ignore
    }

    const prices = products.map((p) => p.price).filter((p) => p > 0);
    const avgPrice = prices.length ? Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)) : 0;
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    const categoryMap: Record<string, number> = {};
    for (const p of products) {
      const cat = p.product_type || 'General';
      categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
    }

    let aiAnalysis: Record<string, unknown> = {
      positioningSummary: isShopify
        ? `Catalog of ${products.length} items averaging $${avgPrice}. Focus on bundling top sellers and offering an entry $9-$15 instant download.`
        : `Storefront "${pageTitle}" analyzed via public HTML metadata.`,
      opportunities: [
        'Offer a $9 entry tier or lead magnet to capture organic YouTube traffic',
        'Bundle complementary templates with video walkthroughs',
        'Use zero-monthly-fee checkout (Payhip/Selar) to maximize net margin',
      ],
    };

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `Analyze this digital storefront for creator positioning opportunities:
URL: ${origin}
Page Title: ${pageTitle}
Meta Description: ${metaDescription}
Shopify Catalog Detected: ${isShopify} (${products.length} products, avg $${avgPrice}, range $${minPrice}-$${maxPrice})
Sample Titles: ${products.slice(0, 12).map((p) => `${p.title} ($${p.price})`).join(', ')}

Return STRICT JSON:
{
  "positioningSummary": "2-sentence positioning analysis",
  "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3", "Opportunity 4"]
}`,
        jsonMode: true,
        maxOutputTokens: 1536,
      });
      aiAnalysis = extractJsonFromText(res.text);
    } catch {
      // Keep deterministic fallback analysis
    }

    return NextResponse.json({
      origin,
      pageTitle,
      metaDescription,
      isShopify,
      productCount: products.length,
      avgPrice,
      minPrice,
      maxPrice,
      categories: Object.entries(categoryMap).map(([name, count]) => ({ name, count })),
      topProducts: products.slice(0, 15),
      aiAnalysis,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Store analysis failed' },
      { status: 400 }
    );
  }
}
