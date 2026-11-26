import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { extractJsonFromText } from '@/lib/utils';

const AnalyzeStyleSchema = z.object({
  youtubeUrl: z.string().optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
});

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0] || null;
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = AnalyzeStyleSchema.parse(await req.json());
    let base64Data = body.imageBase64?.replace(/^data:[^;]+;base64,/, '') ?? '';
    let mimeType = body.imageMimeType || 'image/jpeg';
    let sourceReference = 'Uploaded Screenshot';

    if (!base64Data && body.youtubeUrl) {
      const videoId = extractYouTubeVideoId(body.youtubeUrl);
      if (!videoId) {
        return NextResponse.json({ error: 'Could not extract YouTube video ID from URL' }, { status: 400 });
      }
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      sourceReference = thumbUrl;
      const thumbResp = await fetch(thumbUrl, { signal: AbortSignal.timeout(12000) });
      if (!thumbResp.ok) {
        return NextResponse.json({ error: `Failed to fetch YouTube thumbnail (${thumbResp.status})` }, { status: 400 });
      }
      const arr = await thumbResp.arrayBuffer();
      base64Data = Buffer.from(arr).toString('base64');
      mimeType = 'image/jpeg';
    }

    if (!base64Data) {
      return NextResponse.json({ error: 'Provide either a screenshot upload or a YouTube URL' }, { status: 400 });
    }

    try {
      const res = await generateWithRouter({
        taskType: 'vision',
        prompt: `Analyze this visual reference for Google Flow Nano Banana still-image cloning.
Return STRICT JSON:
{
  "styleHeader": "One dense reusable visual style header describing brushwork/render medium, color palette, lighting, composition, texture, and camera aesthetic",
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "lighting": "lighting summary",
  "framing": "framing summary"
}`,
        images: [{ mimeType, base64Data }],
        jsonMode: true,
        maxOutputTokens: 2048,
      });

      const parsed = extractJsonFromText<{
        styleHeader: string;
        palette: string[];
        lighting: string;
        framing: string;
      }>(res.text);

      return NextResponse.json({
        ...parsed,
        sourceReference,
        provider: `${res.provider}/${res.model}`,
      });
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        return NextResponse.json(
          {
            styleHeader: 'High-contrast cinematic digital illustration, moody rim lighting, rich slate and amber palette, crisp foreground separation, 35mm editorial framing',
            palette: ['#0F172A', '#4F46E5', '#F59E0B', '#F8FAFC'],
            lighting: 'Moody rim light with soft atmospheric depth',
            framing: 'Clean central subject with negative space for captions',
            sourceReference,
            fallbackNotice: err.message,
          },
          { status: 200 }
        );
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Vision style analysis failed' },
      { status: 400 }
    );
  }
}
