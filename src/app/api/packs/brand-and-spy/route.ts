import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';
import { extractJsonFromText } from '@/lib/utils';

const BrandAndSpySchema = z.object({
  mode: z.enum(['BRAND_PACK', 'AD_SPY_PACK']),
  brandOrKeyword: z.string().min(1),
  niche: z.string().min(1),
  mascotIdea: z.string().optional(),
  uploadScheduleText: z.string().optional(),
  textOnlyBanner: z.boolean().default(false),
  targetCountry: z.string().default('US'),
});

export async function POST(req: NextRequest) {
  try {
    const body = BrandAndSpySchema.parse(await req.json());

    if (body.mode === 'BRAND_PACK') {
      const prompt = `Create a consistent YouTube/Creator brand, mascot, and thumbnail prompt pack for "${body.brandOrKeyword}" in niche "${body.niche}".
Mascot Concept: ${body.mascotIdea || 'Memorable expressive geometric creator character'}
Banner Style: ${body.textOnlyBanner ? 'Clean text-only / typography banner (no schedule clutter)' : `Include upload schedule note: "${body.uploadScheduleText || 'New Deep-Dives Every Tuesday & Friday'}"`}

Return STRICT JSON:
{
  "logoPrompt": "Exact prompt for vector-clean channel logo",
  "pfpPrompt": "Exact circular-safe 1:1 profile picture prompt",
  "bannerPrompt": "Exact 2560x1440 YouTube banner safe-zone prompt",
  "mascotMasterPrompt": "Exact character sheet prompt for consistent mascot poses",
  "thumbnailTemplates": ["16:9 bold thumbnail template 1", "16:9 bold thumbnail template 2", "16:9 bold thumbnail template 3"]
}`;

      let parsed: {
        logoPrompt: string;
        pfpPrompt: string;
        bannerPrompt: string;
        mascotMasterPrompt: string;
        thumbnailTemplates: string[];
      };
      let providerSummary = 'Offline Studio Engine';

      try {
        const res = await generateWithRouter({
          taskType: 'fast_generation',
          prompt,
          jsonMode: true,
          maxOutputTokens: 3072,
        });
        parsed = extractJsonFromText(res.text);
        providerSummary = `${res.provider}/${res.model}`;
      } catch (err) {
        if (!(err instanceof AllKeysExhaustedError)) throw err;
        const mascot = body.mascotIdea || 'Minimalist geometric emblem character';
        parsed = {
          logoPrompt: `Vector-clean editorial emblem logo for "${body.brandOrKeyword}" (${body.niche}), obsidian background #09090b, champagne gold lines #d4af37, crisp geometric balance, no clutter.`,
          pfpPrompt: `1:1 circular-safe profile avatar featuring ${mascot} for "${body.brandOrKeyword}", high-contrast centered subject, clean rim lighting.`,
          bannerPrompt: `2560x1440 YouTube channel banner with centered 1546x423 safe zone reading "${body.brandOrKeyword.toUpperCase()}"${body.textOnlyBanner ? ', clean typography only' : `, subtle tagline "${body.uploadScheduleText || 'New Editions Weekly'}"`}, dark obsidian & gold aesthetic.`,
          mascotMasterPrompt: `Character sheet of ${mascot} for "${body.brandOrKeyword}": front, 3/4 turn, and pointing pose, flat editorial shading, consistent palette.`,
          thumbnailTemplates: [
            `16:9 high-contrast split frame for "${body.niche}": bold 3-word hook on left, dramatic visual subject on right, warm gold focal arrow.`,
            `16:9 before-vs-after transformation card for "${body.brandOrKeyword}", clean sans headline, uncluttered dark backdrop.`,
            `16:9 close-up proof artifact thumbnail showing a clean checklist/ledger sheet with high contrast.`,
          ],
        };
      }

      const files = [
        {
          path: 'README.md',
          content: `# Brand, Mascot & Thumbnail Pack — ${body.brandOrKeyword}\n\nReady for Google Flow Nano Banana or local creative workflows.`,
        },
        { path: 'logo_and_pfp_prompts.md', content: `## Logo Prompt\n${parsed.logoPrompt}\n\n## Profile Picture (1:1 Safe Zone)\n${parsed.pfpPrompt}` },
        { path: 'banner_prompt.md', content: `## Channel Banner (2560x1440 Safe Center)\n${parsed.bannerPrompt}` },
        { path: 'mascot_master_profile.md', content: `## Mascot Master Prompt\n${parsed.mascotMasterPrompt}` },
        {
          path: 'thumbnail_prompts_16x9.md',
          content: parsed.thumbnailTemplates.map((t, i) => `### Thumbnail Concept ${i + 1}\n${t}`).join('\n\n'),
        },
      ];

      const compiled = await compileAndSaveZipPack({
        type: 'BRAND_PACK',
        title: `${body.brandOrKeyword} Brand Pack`,
        metadata: { niche: body.niche },
        textFiles: files,
      });

      return NextResponse.json({
        projectId: compiled.project.id,
        files,
        providerSummary,
      });
    }

    // AD_SPY_PACK
    const kw = encodeURIComponent(body.brandOrKeyword);
    const country = body.targetCountry.toUpperCase().slice(0, 2) || 'US';
    const metaUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${kw}&search_type=keyword_unordered`;
    const googleUrl = `https://adstransparency.google.com/?region=${country}&text=${kw}`;

    let spyInsights = '';
    let providerSummary = 'Deterministic Spy Playbook';
    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `List 5 high-signal competitor ad teardown criteria and 5 winning digital product hook angles for keyword "${body.brandOrKeyword}" in country ${country} (${body.niche}).`,
        maxOutputTokens: 2048,
      });
      spyInsights = res.text;
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      spyInsights = '- Hook in first 2 seconds\n- Proof / screen recording\n- Offer clarity & price anchor\n- Landing page CTA placement\n- Trust & instant-download guarantee';
    }

    const files = [
      {
        path: 'README.md',
        content: `# Ad Library & Store Spy Pack — ${body.brandOrKeyword} (${country})\n\n$0 API cost browser-research pack for Google Antigravity + BrowserOS neo (\`FEAICCWS\`).\n\n- **Meta Ad Library URL:** ${metaUrl}\n- **Google Ads Transparency URL:** ${googleUrl}\n`,
      },
      {
        path: 'spy_agent_instructions.md',
        content: `# Antigravity Browser Spy Instructions

1. Launch **BrowserOS neo** using profile **\`FEAICCWS\`**.
2. Open [Meta Ad Library](${metaUrl}).
3. Filter to active ads running > 14 days (strongest signal of profitable spend).
4. Capture top 5 image ads and top 5 video ads; open each destination landing page and log pricing, guarantee, lead magnet, and bundle upsells.
5. Repeat on [Google Ads Transparency Center](${googleUrl}).
6. Fill \`ad_log.csv\` and compile \`competitor_teardown.md\` using \`teardown_rubric.md\`.
`,
      },
      {
        path: 'teardown_rubric.md',
        content: `# Competitor Ad Teardown Rubric\n\n${spyInsights}`,
      },
      {
        path: 'ad_log.csv',
        content: 'platform,advertiser,days_running,format,hook_text,cta,landing_url,price_usd,differentiation_gap\n',
      },
    ];

    const compiled = await compileAndSaveZipPack({
      type: 'AD_SPY_PACK',
      title: `Ad Spy — ${body.brandOrKeyword} (${country})`,
      metadata: { keyword: body.brandOrKeyword, country },
      textFiles: files,
    });

    return NextResponse.json({
      projectId: compiled.project.id,
      files,
      providerSummary,
      triggerPrompts: [
        {
          label: 'Run Ad Spy Research in BrowserOS neo',
          prompt: `Open BrowserOS neo on profile FEAICCWS. Follow spy_agent_instructions.md: inspect active ads on Meta Ad Library (${metaUrl}) and Google Ads Transparency Center (${googleUrl}), log 10 winning ads into ad_log.csv, and summarize differentiation gaps.`,
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate Brand/Spy pack' },
      { status: 400 }
    );
  }
}
