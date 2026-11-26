import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';
import { extractJsonFromText } from '@/lib/utils';

const BulkGenSchema = z.object({
  title: z.string().min(1),
  topic: z.string().min(1),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
  targetMinutes: z.number().min(1).max(10).default(2),
  vibeCloseness: z.enum(['EXACT', 'BALANCED', 'CREATIVE']).default('BALANCED'),
  recurringCharacter: z.string().optional(),
  styleHeader: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = BulkGenSchema.parse(await req.json());
    const sceneCount = Math.max(4, Math.min(75, Math.round(body.targetMinutes * 7.5)));

    const prompt = `Build a Google Flow Nano Banana bulk still-image production pack.
Title: ${body.title}
Topic: ${body.topic}
Aspect Ratio: ${body.aspectRatio}
Scene Count: ${sceneCount} (~7.5 scenes/min for ${body.targetMinutes} min)
Vibe Closeness: ${body.vibeCloseness}
Recurring Character: ${body.recurringCharacter || 'None'}
Global Style Header: ${body.styleHeader}

Requirements:
1. Output ONE copy-paste Google Flow block containing the single global style header at the top followed by two-digit numbered scenes (01, 02, 03... up to ${String(sceneCount).padStart(2, '0')}) so downloaded images stay in exact story order.
2. Output a matching timed narration script aligned to scenes 01..${String(sceneCount).padStart(2, '0')}.

Return STRICT JSON:
{
  "flowBulkBlock": "GLOBAL STYLE HEADER: ...\\n\\n01. ...\\n02. ...",
  "narrationScript": "01 [0:00-0:08]: ...\\n02 [0:08-0:16]: ..."
}`;

    let parsed: { flowBulkBlock: string; narrationScript: string };
    let providerSummary = 'Offline Studio Engine';

    try {
      const res = await generateWithRouter({
        taskType: 'long_context',
        prompt,
        jsonMode: true,
        maxOutputTokens: 6144,
      });

      parsed = extractJsonFromText<{ flowBulkBlock: string; narrationScript: string }>(res.text);
      providerSummary = `${res.provider}/${res.model}`;
    } catch (err) {
      if (!(err instanceof AllKeysExhaustedError)) throw err;
      const lines = Array.from({ length: sceneCount }, (_, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        return `${num}. ${body.aspectRatio} scene ${num} for "${body.title}": visual metaphor illustrating "${body.topic}"${body.recurringCharacter ? ` featuring ${body.recurringCharacter}` : ''}, clean focal composition.`;
      });
      const narrLines = Array.from({ length: sceneCount }, (_, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        const startSec = idx * 8;
        const endSec = startSec + 8;
        const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        return `${num} [${fmt(startSec)}-${fmt(endSec)}]: Voiceover beat ${num} explaining a practical insight on ${body.topic}.`;
      });
      parsed = {
        flowBulkBlock: `GLOBAL STYLE HEADER: ${body.styleHeader}\n\n${lines.join('\n')}`,
        narrationScript: narrLines.join('\n'),
      };
    }

    const ffmpegStitch = `# Local CPU-Friendly Ken Burns Assembly (8th Gen Dell / No GPU)

Each numbered image (\`01.png\`..\`${String(sceneCount).padStart(2, '0')}.png\`) is animated with subtle 8-second zoompan and stitched via Intel QuickSync (\`h264_qsv\`) or \`libx264 -preset veryfast\`:

\`\`\`bash
# Example single-scene Ken Burns clip (16:9 1920x1080, 8s @ 30fps)
ffmpeg -loop 1 -i 01.png -vf "scale=2400:-1,zoompan=z='min(zoom+0.0008,1.12)':d=240:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${body.aspectRatio === '9:16' ? '1080x1920' : '1920x1080'}" -t 8 -c:v libx264 -preset veryfast -pix_fmt yuv420p clip_01.mp4

# Stream-copy concat all clips once generated
ffmpeg -f concat -safe 0 -i clips.txt -i narration.mp3 -c:v copy -c:a aac -shortest final_bulk_video.mp4
\`\`\`
`;

    const files = [
      { path: 'google_flow_bulk_block.txt', content: parsed.flowBulkBlock },
      { path: 'timed_narration_script.md', content: `# Timed Narration Script — ${body.title}\n\n${parsed.narrationScript}` },
      { path: 'ken_burns_ffmpeg.md', content: ffmpegStitch },
      {
        path: 'README.md',
        content: `# ${body.title} — Google Flow Bulk Image Pack\n\n- **Scenes:** ${sceneCount}\n- **Aspect Ratio:** ${body.aspectRatio}\n- **Browser:** BrowserOS neo (\`FEAICCWS\`), Turbo Mode OFF\n`,
      },
    ];

    const compiled = await compileAndSaveZipPack({
      type: 'FLOW_BULK',
      title: body.title,
      metadata: { sceneCount, aspectRatio: body.aspectRatio, styleHeader: body.styleHeader },
      textFiles: files,
    });

    return NextResponse.json({
      projectId: compiled.project.id,
      sceneCount,
      flowBulkBlock: parsed.flowBulkBlock,
      narrationScript: parsed.narrationScript,
      files,
      providerSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate bulk style pack' },
      { status: 400 }
    );
  }
}
