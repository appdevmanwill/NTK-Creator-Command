import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { runCheckpointedJob } from '@/lib/ai-router/checkpoint';
import { compileAndSaveZipPack, PackTextFile } from '@/lib/packs/zip-compiler';
import { extractJsonFromText } from '@/lib/utils';

const OutlineSceneSchema = z.object({
  sceneNumber: z.number().int().min(1),
  title: z.string(),
  locationName: z.string(),
  summary: z.string(),
  shotCount: z.number().int().min(2).max(16).default(6),
});

const BuildMoviePackSchema = z.object({
  existingJobId: z.string().optional(),
  format: z.enum(['ONE_OFF', 'NEW_SERIES', 'CONTINUE_SERIES']).default('ONE_OFF'),
  seriesGroupId: z.string().optional().nullable(),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
  runtimeMinutes: z.number().min(1).max(60).default(4),
  outline: z.object({
    title: z.string().min(1),
    logline: z.string().min(1),
    characters: z.array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        visualIdentity: z.string(),
        voiceNote: z.string().optional(),
      })
    ),
    locations: z.array(
      z.object({
        name: z.string(),
        visualProfile: z.string(),
      })
    ),
    scenes: z.array(OutlineSceneSchema).min(1),
  }),
  zeroKeyPastedJson: z.string().optional(),
});

interface MovieJobState extends Record<string, unknown> {
  charactersMd?: string;
  locationsMd?: string;
  scenesData?: Array<{ sceneNumber: number; title: string; markdown: string; shots: Array<{ shot: string; prompt: string; dialogue: string }> }>;
  _lastProviderUsed?: string;
}

function buildStaticDocs(
  input: z.infer<typeof BuildMoviePackSchema>,
  charactersMd: string,
  locationsMd: string,
  scenesData: Array<{ sceneNumber: number; title: string; markdown: string; shots: Array<{ shot: string; prompt: string; dialogue: string }> }>
): PackTextFile[] {
  const estCredits = Math.round(input.runtimeMinutes * 240);
  const readme = `# ${input.outline.title} — Google Flow AI Production Pack

- **Format:** ${input.format}
- **Aspect Ratio:** ${input.aspectRatio}
- **Target Runtime:** ${input.runtimeMinutes} min
- **Estimated Google Flow Credits:** ~${estCredits.toLocaleString()} credits (~240 credits/min, 1 clip per shot)

## Synopsis
${input.outline.logline}

## Execution Order
1. Launch **BrowserOS neo** using profile **\`FEAICCWS\`** (already logged into your Google Flow account).
2. Read \`flow_agent_instructions.md\` carefully before touching the UI.
3. Keep **Turbo Mode OFF** at all times and inspect every generated clip before downloading.
4. Create all Character Profiles from \`characters.md\` first.
5. Create all Location Profiles (stored as Google Flow character profiles for consistency) from \`locations.md\`.
6. Execute \`scene_01.md\` first (or the first 8 shots) as a consistency smoke test before generating remaining scenes.
7. Assemble downloaded clips locally using \`edit_instructions.md\` (CPU-friendly FFmpeg).
`;

  const flowInstructions = `# Google Flow Agent Execution Instructions

- **Browser:** BrowserOS neo (profile \`FEAICCWS\`)
- **Target URL:** https://labs.google/fx/tools/flow
- **Aspect Ratio:** \`${input.aspectRatio}\`
- **Credit Saver Rule:** Set outputs per prompt to **1 clip per shot** (instead of 2) to cut credit burn by 50% (~240 credits/min).
- **Safety Rule:** Keep **Turbo Mode OFF**. Wait for each clip render, visually inspect faces/props/lighting for drift before clicking Download.
- **Profile Attachment:** On EVERY shot in \`scene_XX.md\`, attach the listed \`@Character\` and \`@Location\` profiles from \`characters.md\` and \`locations.md\` before clicking Generate.
- **Naming Convention:** Save downloaded clips as \`scene_XX_shot_YY.mp4\` inside \`./raw_clips/\`.
`;

  const shotListLines = [
    `# Master Shot List — ${input.outline.title}`,
    ``,
    `| Scene | Title | Shots | Location Profile |`,
    `| --- | --- | --- | --- |`,
    ...input.outline.scenes.map(
      (s) => `| ${String(s.sceneNumber).padStart(2, '0')} | ${s.title} | ${s.shotCount} | ${s.locationName} |`
    ),
    ``,
    ...scenesData.map((sc) => `## Scene ${String(sc.sceneNumber).padStart(2, '0')}: ${sc.title}\n${sc.markdown}`),
  ];

  const editInstructions = `# Local CPU-Friendly Video Assembly (8th Gen Intel / No GPU)

1. **Zero-Reencode Concatenation (Fastest — Instant Stream Copy):**
   Create \`concat.txt\` listing clips in order (\`file 'raw_clips/scene_01_shot_01.mp4'\`), then run:
   \`\`\`bash
   ffmpeg -f concat -safe 0 -i concat.txt -c copy assembled_master.mp4
   \`\`\`

2. **Hardware-Accelerated Intel QuickSync Re-encode (Fallback to \`libx264 -preset veryfast\`):**
   Use when normalizing mixed frame rates, adding music ducking, or burning a subtle watermark:
   \`\`\`bash
   # Intel QuickSync (8th Gen iGPU)
   ffmpeg -i assembled_master.mp4 -i narration_or_music.mp3 -filter_complex "[1:a]volume=0.22[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v h264_qsv -global_quality 22 -c:a aac -b:a 192k final_release.mp4

   # CPU Fallback if QSV driver unavailable
   ffmpeg -i assembled_master.mp4 -i narration_or_music.mp3 -filter_complex "[1:a]volume=0.22[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v libx264 -preset veryfast -crf 21 -c:a aac -b:a 192k final_release.mp4
   \`\`\`

3. **Word-Boundary Trimming & Subtitles:**
   Offload Whisper transcription to **Groq \`whisper-large-v3\`** or the **Kaggle/Colab Cloud Whisper Notebook** to get word-level timestamps, then trim dead air with \`-ss\` / \`-to\` and \`-c copy\`.
`;

  const files: PackTextFile[] = [
    { path: 'README.md', content: readme },
    { path: 'characters.md', content: charactersMd },
    { path: 'locations.md', content: locationsMd },
    { path: 'flow_agent_instructions.md', content: flowInstructions },
    { path: 'shot_list.md', content: shotListLines.join('\n') },
    { path: 'edit_instructions.md', content: editInstructions },
  ];

  for (const sc of scenesData) {
    const num = String(sc.sceneNumber).padStart(2, '0');
    files.push({
      path: `scenes/scene_${num}.md`,
      content: `# Scene ${num}: ${sc.title}\n\n${sc.markdown}\n`,
    });
  }

  return files;
}

export async function POST(req: NextRequest) {
  try {
    const body = BuildMoviePackSchema.parse(await req.json());

    // Zero-Key Manual Import Path
    if (body.zeroKeyPastedJson?.trim()) {
      const parsed = extractJsonFromText<{
        charactersMd?: string;
        locationsMd?: string;
        scenes?: Array<{ sceneNumber: number; title: string; markdown: string }>;
      }>(body.zeroKeyPastedJson);
      const charsMd =
        parsed.charactersMd ||
        body.outline.characters.map((c) => `## ${c.name}\n- Visual: ${c.visualIdentity}`).join('\n\n');
      const locsMd =
        parsed.locationsMd ||
        body.outline.locations.map((l) => `## ${l.name} (Flow Profile)\n- Profile: ${l.visualProfile}`).join('\n\n');
      const scData = (parsed.scenes ?? body.outline.scenes).map((s, idx) => ({
        sceneNumber: 'sceneNumber' in s ? s.sceneNumber : idx + 1,
        title: s.title,
        markdown: 'markdown' in s ? s.markdown : (s as { summary?: string }).summary || '',
        shots: [],
      }));
      const files = buildStaticDocs(body, charsMd, locsMd, scData);
      const compiled = await compileAndSaveZipPack({
        type: 'FLOW_MOVIE',
        title: body.outline.title,
        seriesGroupId: body.seriesGroupId || body.outline.title,
        metadata: { outline: body.outline, aspectRatio: body.aspectRatio, runtimeMinutes: body.runtimeMinutes },
        textFiles: files,
      });
      return NextResponse.json({
        status: 'COMPLETED',
        projectId: compiled.project.id,
        files,
        providerSummary: 'ZERO_KEY_IMPORT',
      });
    }

    const steps = [
      {
        name: 'Generate Character & Location Flow Profiles',
        run: async (state: MovieJobState, ctx: { jobId: string }) => {
          const prompt = `Create two detailed Markdown sections for Google Flow consistency profiles for "${body.outline.title}" (${body.aspectRatio}):
Characters: ${JSON.stringify(body.outline.characters)}
Locations: ${JSON.stringify(body.outline.locations)}

Return STRICT JSON:
{
  "charactersMd": "# Character Profiles (Google Flow)\\n\\nEach character with Portrait Prompt, Full-Body Prompt, Flow Profile Description, and Voice/Accent Notes",
  "locationsMd": "# Location Profiles (Saved as Google Flow Character Profiles)\\n\\nEach location formatted explicitly as a Google Flow profile for shot-to-shot consistency"
}`;
          const res = await generateWithRouter({
            taskType: 'long_context',
            prompt,
            jsonMode: true,
            maxOutputTokens: 4096,
            jobId: ctx.jobId,
          });
          const parsed = extractJsonFromText<{ charactersMd: string; locationsMd: string }>(res.text);
          return {
            ...state,
            charactersMd: parsed.charactersMd,
            locationsMd: parsed.locationsMd,
            _lastProviderUsed: `${res.provider}/${res.model}`,
          };
        },
        buildZeroKeyPromptForStep: () =>
          `Generate charactersMd and locationsMd JSON for ${body.outline.title}.`,
      },
      ...body.outline.scenes.map((scene) => ({
        name: `Generate Scene ${String(scene.sceneNumber).padStart(2, '0')}: ${scene.title}`,
        run: async (state: MovieJobState, ctx: { jobId: string }) => {
          const prompt = `Write detailed shot-by-shot Google Flow prompts for Scene ${scene.sceneNumber}: "${scene.title}" (${scene.shotCount} shots, ${body.aspectRatio}).
Movie: ${body.outline.title}
Location Profile to attach: ${scene.locationName}
Scene Summary: ${scene.summary}
Characters available: ${body.outline.characters.map((c) => c.name).join(', ')}

Return clean Markdown listing Shot 01..Shot ${String(scene.shotCount).padStart(2, '0')} with:
- Attached Profiles (\`@Character\`, \`@${scene.locationName}\`)
- Camera framing & motion
- Exact Google Flow prompt
- Spoken dialogue / audio cue`;
          const res = await generateWithRouter({
            taskType: 'fast_generation',
            prompt,
            maxOutputTokens: 4096,
            jobId: ctx.jobId,
          });
          const prev = state.scenesData ?? [];
          return {
            ...state,
            scenesData: [
              ...prev,
              {
                sceneNumber: scene.sceneNumber,
                title: scene.title,
                markdown: res.text,
                shots: [],
              },
            ],
            _lastProviderUsed: `${res.provider}/${res.model}`,
          };
        },
        buildZeroKeyPromptForStep: () =>
          `Write Scene ${scene.sceneNumber} (${scene.title}) shot prompts (${scene.shotCount} shots) in Markdown.`,
      })),
    ];

    const runResult = await runCheckpointedJob<MovieJobState>({
      existingJobId: body.existingJobId,
      moduleType: 'FLOW_MOVIE',
      title: body.outline.title,
      initialState: { scenesData: [] },
      steps,
    });

    if (runResult.status === 'PAUSED_QUOTA') {
      if (runResult.completedSteps === 0) {
        const offlineCharsMd =
          '# Character Profiles (Google Flow)\n\n' +
          body.outline.characters
            .map(
              (c) =>
                `## ${c.name} (${c.role || 'Cast'})\n- **Visual Identity:** ${c.visualIdentity}\n- **Voice/Tone:** ${c.voiceNote || 'Natural, clear delivery'}`
            )
            .join('\n\n');
        const offlineLocsMd =
          '# Location Profiles (Saved as Google Flow Character Profiles)\n\n' +
          body.outline.locations
            .map((l) => `## ${l.name}\n- **Visual Profile:** ${l.visualProfile}`)
            .join('\n\n');
        const charHandles = body.outline.characters.map((c) => `@${c.name.replace(/\s+/g, '')}`).join(', ');
        const offlineScenesData = body.outline.scenes.map((sc) => {
          const shots = Array.from({ length: sc.shotCount }, (_, i) => {
            const shotNum = String(i + 1).padStart(2, '0');
            return `### Shot ${shotNum}\n- **Attached Profiles:** ${charHandles}, @${sc.locationName.replace(/\s+/g, '')}\n- **Framing:** ${i === 0 ? 'Wide establishing push-in' : i % 2 === 0 ? 'Medium over-the-shoulder' : 'Close-up reaction'}\n- **Google Flow Prompt:** ${body.aspectRatio} cinematic shot in ${sc.locationName}: ${sc.summary} (beat ${i + 1}/${sc.shotCount}), consistent lighting and wardrobe.\n- **Audio Cue:** Subtle ambient room tone & clear voiceover beat.`;
          }).join('\n\n');
          return {
            sceneNumber: sc.sceneNumber,
            title: sc.title,
            markdown: shots,
            shots: [],
          };
        });
        const files = buildStaticDocs(body, offlineCharsMd, offlineLocsMd, offlineScenesData);
        const compiled = await compileAndSaveZipPack({
          type: 'FLOW_MOVIE',
          title: body.outline.title,
          seriesGroupId: body.seriesGroupId || body.outline.title,
          metadata: {
            outline: body.outline,
            aspectRatio: body.aspectRatio,
            runtimeMinutes: body.runtimeMinutes,
            charactersMd: offlineCharsMd,
            locationsMd: offlineLocsMd,
          },
          textFiles: files,
        });
        return NextResponse.json({
          status: 'COMPLETED',
          projectId: compiled.project.id,
          files,
          triggerPrompts: [
            {
              label: 'Test Scene 1 Only (Opening 8 Shots)',
              prompt: `Open BrowserOS neo using profile FEAICCWS. Go to Google Flow, keep Turbo Mode OFF, set ${body.aspectRatio} and 1 clip per shot. Create profiles from characters.md and locations.md, then run ONLY Scene 1 from scenes/scene_01.md.`,
            },
          ],
          providerSummary: 'Offline Studio Engine',
        });
      }
      return NextResponse.json(
        {
          status: 'PAUSED_QUOTA',
          jobId: runResult.jobId,
          completedSteps: runResult.completedSteps,
          totalSteps: runResult.totalSteps,
          retryAfterSeconds: runResult.retryAfterSeconds,
          zeroKeyRemainingPrompt: runResult.zeroKeyRemainingPrompt,
          error: runResult.error,
        },
        { status: 429 }
      );
    }

    if (runResult.status === 'FAILED') {
      return NextResponse.json({ error: runResult.error || 'Movie generation failed' }, { status: 500 });
    }

    const charactersMd =
      runResult.state.charactersMd ||
      body.outline.characters.map((c) => `## ${c.name}\n${c.visualIdentity}`).join('\n\n');
    const locationsMd =
      runResult.state.locationsMd ||
      body.outline.locations.map((l) => `## ${l.name}\n${l.visualProfile}`).join('\n\n');
    const scenesData = runResult.state.scenesData ?? [];

    const files = buildStaticDocs(body, charactersMd, locationsMd, scenesData);
    const compiled = await compileAndSaveZipPack({
      type: 'FLOW_MOVIE',
      title: body.outline.title,
      seriesGroupId: body.seriesGroupId || body.outline.title,
      metadata: {
        outline: body.outline,
        aspectRatio: body.aspectRatio,
        runtimeMinutes: body.runtimeMinutes,
        charactersMd,
        locationsMd,
      },
      textFiles: files,
    });

    const triggerPrompts = [
      {
        label: 'Test Scene 1 Only (Opening 8 Shots)',
        prompt: `Open BrowserOS neo using profile FEAICCWS. Go to Google Flow, keep Turbo Mode OFF, set ${body.aspectRatio} and 1 clip per shot. Create profiles from characters.md and locations.md, then run ONLY Scene 1 (opening shots) from scenes/scene_01.md and report visual consistency before continuing.`,
      },
      {
        label: 'Build Full Movie (Scene by Scene)',
        prompt: `Open BrowserOS neo using profile FEAICCWS. Follow README.md and flow_agent_instructions.md in this pack. Generate all scenes sequentially (scene_01.md..scene_${String(scenesData.length).padStart(2, '0')}.md) with Turbo Mode OFF and 1 clip per shot, saving clips to ./raw_clips/, then run edit_instructions.md.`,
      },
      {
        label: 'Fix Consistency Issue',
        prompt: `Review the generated clip showing visual drift against characters.md and locations.md. Re-attach the exact @Character and @Location profiles in Google Flow (BrowserOS neo FEAICCWS, Turbo Mode OFF) and regenerate ONLY that shot with locked wardrobe/lighting descriptors.`,
      },
    ];

    return NextResponse.json({
      status: 'COMPLETED',
      jobId: runResult.jobId,
      projectId: compiled.project.id,
      files,
      triggerPrompts,
      providerSummary: runResult.lastProviderUsed || runResult.state._lastProviderUsed || 'Router',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build Flow movie pack' },
      { status: 400 }
    );
  }
}
