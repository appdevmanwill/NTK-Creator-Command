import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';
import { extractJsonFromText } from '@/lib/utils';

const FunnelSchema = z.object({
  attachedProjectId: z.string().optional().nullable(),
  productTitle: z.string().min(1),
  productSummary: z.string().min(1),
  targetAudience: z.string().default('Busy beginners looking for a fast win'),
  platform: z.enum(['SELAR', 'PAYHIP', 'GUMROAD', 'SHOPIFY']).default('PAYHIP'),
  storeUrl: z.string().default('https://payhip.com/yourstore/flagship-product'),
  starterPriceUsd: z.number().min(3).max(99).default(15),
});

export async function POST(req: NextRequest) {
  try {
    const body = FunnelSchema.parse(await req.json());
    let attachedContext = '';
    if (body.attachedProjectId) {
      const p = await prisma.project.findUnique({ where: { id: body.attachedProjectId } });
      if (p) {
        attachedContext = `\nAttached Created Product: ${p.title} (${p.type})`;
      }
    }

    const prompt = `Build a complete Storefront Copy, Funnel & "One Product, Many Videos" Organic Promo Kit for:
Product: ${body.productTitle}
Summary: ${body.productSummary}${attachedContext}
Audience: ${body.targetAudience}
Storefront Platform: ${body.platform} (${body.platform === 'SHOPIFY' ? 'Shopify storefront' : 'Zero-monthly-fee instant digital storefront'})
Store Link: ${body.storeUrl}
Starter Price: $${body.starterPriceUsd}

Return STRICT JSON:
{
  "heroHeadline": "High-converting outcome headline",
  "instantDownloadBenefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
  "pricingLadder": [
    { "tier": "Starter Edition", "price": "$9", "includes": "..." },
    { "tier": "Complete Bundle", "price": "$${body.starterPriceUsd}", "includes": "..." },
    { "tier": "Pro + Bonus Templates", "price": "$25", "includes": "..." }
  ],
  "aboutSection": "Trust-building creator about section",
  "leadMagnetHook": "Free checklist/newsletter opt-in hook",
  "desktopBannerPrompt": "Image prompt for desktop store banner",
  "mobileBannerPrompt": "Image prompt for mobile store banner",
  "tenVideoContentPlan": [
    { "videoNumber": 1, "angle": "...", "hook": "...", "cta": "Point to ${body.storeUrl}" }
  ],
  "presenterPromoScript45s": "Full 45-60s presenter promo script",
  "verticalShowcaseScript12s": "Full 10-15s vertical showcase script"
}`;

    try {
      const res = await generateWithRouter({
        taskType: 'long_context',
        prompt,
        jsonMode: true,
        maxOutputTokens: 4096,
      });

      const parsed = extractJsonFromText<Record<string, unknown>>(res.text);
      const files = [
        {
          path: 'storefront_copy.md',
          content: `# Storefront Copy (${body.platform}) — ${body.productTitle}\n\n## Hero Headline\n${parsed.heroHeadline}\n\n## Instant Download Benefits\n${((parsed.instantDownloadBenefits as string[]) ?? []).map((b) => `- ${b}`).join('\n')}\n\n## Pricing Ladder ($7–$25 Sweet Spot)\n${JSON.stringify(parsed.pricingLadder, null, 2)}\n\n## About Section\n${parsed.aboutSection}\n\n## Free Lead-Magnet / Newsletter Hook\n${parsed.leadMagnetHook}\n`,
        },
        {
          path: 'banner_prompts.md',
          content: `# Store Banner Prompts\n\n## Desktop Banner\n${parsed.desktopBannerPrompt}\n\n## Mobile Banner\n${parsed.mobileBannerPrompt}\n`,
        },
        {
          path: 'one_product_10_videos_plan.md',
          content: `# "One Product, Many Videos" Organic Content Plan\nStore Link (Never Change): ${body.storeUrl}\n\n${((parsed.tenVideoContentPlan as Array<{ videoNumber: number; angle: string; hook: string; cta: string }>) ?? [])
            .map((v) => `### Video ${v.videoNumber}: ${v.angle}\n- **Hook:** ${v.hook}\n- **CTA:** ${v.cta}`)
            .join('\n\n')}\n`,
        },
        {
          path: 'promo_scripts.md',
          content: `# Promo Scripts\n\n## 45–60s Presenter Promo Script\n${parsed.presenterPromoScript45s}\n\n## 10–15s Vertical Product Showcase Script\n${parsed.verticalShowcaseScript12s}\n`,
        },
      ];

      const compiled = await compileAndSaveZipPack({
        type: 'STORE_FUNNEL',
        title: `${body.productTitle} Launch Funnel`,
        metadata: { platform: body.platform, storeUrl: body.storeUrl, funnel: parsed },
        textFiles: files,
      });

      return NextResponse.json({
        projectId: compiled.project.id,
        funnel: parsed,
        files,
        providerSummary: `${res.provider}/${res.model}`,
      });
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        return NextResponse.json(
          { zeroKeyMode: true, zeroKeyPrompt: buildZeroKeyMetaPrompt('Store Copy & Funnel', prompt), error: err.message },
          { status: 429 }
        );
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build store funnel' },
      { status: 400 }
    );
  }
}
