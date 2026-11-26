import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { extractJsonFromText } from '@/lib/utils';

const OutlineSchema = z.object({
  format: z.enum(['ONE_OFF', 'NEW_SERIES', 'CONTINUE_SERIES']),
  seriesProjectId: z.string().optional().nullable(),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
  runtimeMinutes: z.number().min(1).max(60).default(4),
  outlineMode: z.enum(['ONE_LINE', 'MANUAL']),
  idea: z.string().optional(),
  manualTitle: z.string().optional(),
  manualCharacters: z.string().optional(),
  manualLocations: z.string().optional(),
  manualPlot: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = OutlineSchema.parse(await req.json());
    let carriedContext = '';
    if (body.format === 'CONTINUE_SERIES' && body.seriesProjectId) {
      const prior = await prisma.project.findUnique({ where: { id: body.seriesProjectId } });
      if (prior) {
        carriedContext = `\nCarry forward exact visual continuity from previous series episode "${prior.title}":\n${prior.metadataJson.slice(0, 3500)}\n`;
      }
    }

    const sceneCount = Math.max(2, Math.min(12, Math.round(body.runtimeMinutes * 1.2)));
    const basePrompt =
      body.outlineMode === 'MANUAL'
        ? `Expand this manual movie specification into a cohesive Google Flow production outline with ${sceneCount} scenes:
Title: ${body.manualTitle || 'Untitled Story'}
Characters: ${body.manualCharacters || 'Lead Protagonist'}
Locations: ${body.manualLocations || 'Primary Set'}
Plot: ${body.manualPlot || body.idea || 'Cinematic dramatic arc'}`
        : `Create a cohesive Google Flow AI movie outline for a ${body.runtimeMinutes}-minute (${body.aspectRatio}) production with ${sceneCount} scenes from this 1-line idea:
"${body.idea || 'A lone courier discovers an encrypted voice message on a rainy midnight bus.'}"`;

    const fullPrompt = `${basePrompt}${carriedContext}

Return STRICT JSON ONLY with this exact schema:
{
  "title": "Movie/Episode Title",
  "logline": "2-sentence compelling synopsis",
  "characters": [
    { "name": "Character Name", "role": "Lead/Supporting", "visualIdentity": "Exact wardrobe, age, hair, face, lighting traits", "voiceNote": "Accent/tone" }
  ],
  "locations": [
    { "name": "Location Profile Name (e.g. Night Bus Interior)", "visualProfile": "Exact architectural, lighting, color palette, lens mood description for Google Flow profile consistency" }
  ],
  "scenes": [
    { "sceneNumber": 1, "title": "Scene Title", "locationName": "Location Profile Name", "summary": "Action, dialogue beat, camera mood", "shotCount": 6 }
  ]
}`;

    try {
      const res = await generateWithRouter({
        taskType: 'long_context',
        prompt: fullPrompt,
        systemPrompt: 'You are an expert AI film showrunner structuring production-ready Google Flow packs. Return valid JSON only.',
        jsonMode: true,
        maxOutputTokens: 4096,
      });
      const outline = extractJsonFromText(res.text);
      return NextResponse.json({
        outline,
        provider: `${res.provider}/${res.model}`,
      });
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        return NextResponse.json(
          {
            zeroKeyMode: true,
            zeroKeyPrompt: buildZeroKeyMetaPrompt('Google Flow Movie Outline', fullPrompt),
            error: err.message,
          },
          { status: 429 }
        );
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate outline' },
      { status: 400 }
    );
  }
}
