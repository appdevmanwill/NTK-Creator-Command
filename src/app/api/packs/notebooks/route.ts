import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { buildCloudGpuLabNotebook } from '@/lib/packs/colab-music-video-nb';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';

const NotebookSchema = z.object({
  template: z.enum(['AI_MUSIC', 'MUSIC_VIDEO_SHORTS', 'TALKING_PROMO', 'WHISPER_UPSCALE']),
  platform: z.enum(['KAGGLE', 'COLAB']).default('COLAB'),
  title: z.string().min(1),
  promptOrLyrics: z.string().min(1),
  bpmOrSpeed: z.string().default('118'),
  aspectRatio: z.enum(['16:9', '9:16']).default('9:16'),
  extraNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = NotebookSchema.parse(await req.json());

    let enrichedGuide = '';
    let providerSummary = 'Verified Cloud GPU Pipeline';
    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `Write 4 concise inference notes (NO model training, NO learning rate/epochs) for running "${body.template}" titled "${body.title}" on a free ${body.platform} T4 GPU. Goal: ${body.promptOrLyrics}`,
        maxOutputTokens: 512,
      });
      enrichedGuide = res.text;
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      enrichedGuide =
        '- Uses free Tesla T4/P100 GPU with automatic float32 NaN protection for ACE-Step 1.5.\n- Automatically generates visuals, beat-synced MP4 video, and -14 LUFS mastered MP3.\n- Verifies ./outputs/ is non-empty before creating ntk_cloud_gpu_output.zip.';
    }

    const ipynbString = buildCloudGpuLabNotebook({
      template: body.template,
      platform: body.platform,
      title: body.title,
      promptOrLyrics: body.promptOrLyrics,
      bpmOrSpeed: body.bpmOrSpeed,
      aspectRatio: body.aspectRatio,
      extraNotes: body.extraNotes,
    });

    const agentInstructions = `# ${body.platform} Agent Execution Instructions

1. Launch **BrowserOS neo** on profile **\`FEAICCWS\`**.
2. Open ${
      body.platform === 'KAGGLE'
        ? 'https://www.kaggle.com/code (New Notebook -> Settings -> Accelerator: GPU T4 x2 / P100 + Internet ON)'
        : 'https://colab.research.google.com/ (File -> Upload Notebook -> Runtime -> Change runtime type -> T4 GPU)'
    }.
3. Upload \`notebook.ipynb\` from this pack.
4. Optional: upload your own Flow clips/images into \`./inputs/\`. (If you leave \`./inputs/\` empty, the notebook generates visuals automatically so you never get an empty ZIP.)
5. Keep **Turbo Mode OFF** and run all cells sequentially, waiting for each cell's checkmark before continuing.
6. Download \`ntk_cloud_gpu_output.zip\` containing your finished audio, MP4 video, and captions.
`;

    const files = [
      { path: 'notebook.ipynb', content: ipynbString },
      { path: 'agent_run_instructions.md', content: agentInstructions },
      {
        path: 'README.md',
        content: `# ${body.title}\n\n- **Template:** ${body.template}\n- **Target Host:** ${body.platform}\n\n## Runtime Notes\n${enrichedGuide}\n`,
      },
    ];

    const compiled = await compileAndSaveZipPack({
      type: 'KAGGLE_COLAB',
      title: body.title,
      metadata: { template: body.template, platform: body.platform, nbformat: 4 },
      textFiles: files,
    });

    return NextResponse.json({
      projectId: compiled.project.id,
      files,
      providerSummary,
      triggerPrompts: [
        {
          label: `Run on ${body.platform} via BrowserOS neo`,
          prompt: `Open BrowserOS neo using profile FEAICCWS. Follow agent_run_instructions.md: upload notebook.ipynb to ${body.platform}, enable T4/P100 GPU (and Internet ON for Kaggle), run all cells sequentially, verify outputs/ is non-empty, and download ntk_cloud_gpu_output.zip.`,
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build notebook pack' },
      { status: 400 }
    );
  }
}
