import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';

const BlueprintSchema = z.object({
  channelName: z.string().min(1),
  niche: z.string().min(1),
  targetAudience: z.string().min(1),
  flagshipProduct: z.string().min(1),
  storePlatform: z.string().default('Payhip'),
  visualStyle: z.string().default('Minimalist Indigo Stickman / Infographic'),
  uploadCadence: z.string().default('3 videos per week'),
  googleAccountAgeNote: z.string().default('Using an aged Google account for YouTube channel trust & higher initial reach'),
});

export async function POST(req: NextRequest) {
  try {
    const body = BlueprintSchema.parse(await req.json());

    let customBlueprintNotes = '';
    let providerSummary = 'Deterministic Blueprint';
    try {
      const res = await generateWithRouter({
        taskType: 'long_context',
        prompt: `Create a tight 5-phase NotebookLM Source Brief for launching channel "${body.channelName}" in niche "${body.niche}" selling "${body.flagshipProduct}" on ${body.storePlatform}. Include 3 launch video titles and consistent cover branding rules.`,
        maxOutputTokens: 2048,
      });
      customBlueprintNotes = res.text;
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      customBlueprintNotes = `1. Niche Positioning: ${body.niche}\n2. Audience: ${body.targetAudience}\n3. Flagship Offer: ${body.flagshipProduct} on ${body.storePlatform}\n4. Visual Identity: ${body.visualStyle}`;
    }

    const sequentialPrompt = `# NOTEBOOKLM SEQUENTIAL "TYPE NEXT" LAUNCH PROMPT — ${body.channelName}

Paste this entire Master Prompt into NotebookLM (or Gemini/ChatGPT) as your Channel & Product Source Bible. Tell the assistant: **"Execute Step 1 ONLY, then wait for me to type \`next\`."**

---
## CHANNEL & PRODUCT BIBLE
- **Channel Name:** ${body.channelName}
- **Niche:** ${body.niche}
- **Target Audience:** ${body.targetAudience}
- **Flagship Digital Product:** ${body.flagshipProduct} (${body.storePlatform})
- **Visual & Cover Branding:** ${body.visualStyle} (Keep identical cover badge, font hierarchy, and brand color across every ebook/planner/thumbnail)
- **Upload Cadence:** ${body.uploadCadence}
- **Channel Trust Tip:** ${body.googleAccountAgeNote}

## SEQUENTIAL STEPS (WAIT FOR "next" BETWEEN STEPS)
- **Step 1 (Channel Identity & Branding):** Confirm PFP, banner, bio with permanent store link, and 3 playlists. STOP and ask me to type \`next\`.
- **Step 2 (Flagship Digital Product Outline):** Outline "${body.flagshipProduct}" with practical takeaways and a $9/$15/$25 pricing ladder. STOP and ask me to type \`next\`.
- **Step 3 (First 5 Evergreen Video Hooks & Scripts):** Write opening 15-second hooks + 8-minute retention outlines pointing seamlessly to the single permanent store link. STOP and ask me to type \`next\`.
- **Step 4 (Thumbnail & Packaging QA):** Generate 5 high-CTR title + 16:9 thumbnail pairs avoiding clutter. STOP and ask me to type \`next\`.
- **Step 5 (30-Day Launch & Analytics Loop):** Give the exact 30-day upload schedule and retention/CTR iteration checklist.

---
## AI-ENRICHED NOTES
${customBlueprintNotes}
`;

    const files = [
      { path: 'notebooklm_sequential_prompt.md', content: sequentialPrompt },
      { path: 'channel_bible_summary.md', content: `# ${body.channelName} — Channel Bible\n\n${customBlueprintNotes}` },
    ];

    const compiled = await compileAndSaveZipPack({
      type: 'UNIVERSAL_PACK',
      title: `${body.channelName} NotebookLM Blueprint`,
      metadata: { niche: body.niche, flagshipProduct: body.flagshipProduct },
      textFiles: files,
    });

    return NextResponse.json({
      projectId: compiled.project.id,
      sequentialPrompt,
      files,
      providerSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build NotebookLM blueprint' },
      { status: 400 }
    );
  }
}
