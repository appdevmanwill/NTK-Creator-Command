import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';
import { buildMusicVideoStudioPack } from '@/lib/packs/music-studio-builder';

const MusicStudioSchema = z.object({
  platform: z
    .enum([
      'GOOGLE_FLOW',
      'SUNO',
      'TREBLO',
      'ACE_STUDIO',
      'UDIO',
      'MUREKA',
      'RIFFUSION',
      'ELEVENLABS_MUSIC',
      'COLAB_KAGGLE_OPEN',
      'ALL_PLATFORMS_MASTER',
    ])
    .default('GOOGLE_FLOW'),
  mode: z
    .enum(['SINGLE_AUDIO_AND_VIDEO', 'ALBUM_STREAM_PACK', 'SCORE_FLOW_MOVIE'])
    .default('SINGLE_AUDIO_AND_VIDEO'),
  cloudHost: z.enum(['COLAB', 'KAGGLE']).default('COLAB'),
  colabEngine: z.enum(['ACE_STEP_1_5', 'DIFFRHYTHM', 'MUSICGEN_MEDIUM']).default('ACE_STEP_1_5'),
  title: z.string().min(1),
  theme: z.string().min(1),
  genre: z.string().default('Afrobeats / Afro-Synth'),
  mood: z.string().default('Cinematic, Uplifting & Warm'),
  bpm: z.number().int().min(50).max(220).default(108),
  musicalKey: z.string().default('C minor'),
  vocalMode: z.enum(['VOCAL', 'INSTRUMENTAL']).default('VOCAL'),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
  visualStyle: z.string().default('35mm neo-noir rain reflections, warm champagne gold & obsidian palette'),
  excludeTraits: z.string().default('harsh clipping, muddy low end, abrupt cutoff'),
  customLyrics: z.string().optional(),
  trackCount: z.number().int().min(4).max(12).optional(),
  attachedMovieProjectId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = MusicStudioSchema.parse(await req.json());

    let attachedMovieTitle: string | undefined;
    let attachedMovieScenes:
      | Array<{ sceneNumber: number; title: string; summary: string; shotCount: number }>
      | undefined;

    if (body.mode === 'SCORE_FLOW_MOVIE' && body.attachedMovieProjectId) {
      const prior = await prisma.project.findUnique({ where: { id: body.attachedMovieProjectId } });
      if (prior) {
        attachedMovieTitle = prior.title;
        try {
          const meta = JSON.parse(prior.metadataJson || '{}') as {
            outline?: {
              scenes?: Array<{ sceneNumber: number; title: string; summary: string; shotCount: number }>;
            };
          };
          attachedMovieScenes = meta.outline?.scenes;
        } catch {
          // ignore malformed metadata
        }
      }
    }

    const pack = await buildMusicVideoStudioPack({
      ...body,
      attachedMovieTitle,
      attachedMovieScenes,
    });

    const compiled = await compileAndSaveZipPack({
      type: 'MUSIC_VIDEO_PACK',
      title: body.title,
      metadata: {
        platform: body.platform,
        mode: body.mode,
        cloudHost: body.cloudHost,
        colabEngine: body.colabEngine,
        bpm: body.bpm,
        musicalKey: body.musicalKey,
        aspectRatio: body.aspectRatio,
      },
      textFiles: pack.textFiles,
      binaryFiles: pack.binaryFiles,
    });

    return NextResponse.json({
      projectId: compiled.project.id,
      files: pack.textFiles,
      triggerPrompts: pack.triggerPrompts,
      copyPasteMasterPrompt: pack.copyPasteMasterPrompt,
      platformSpec: pack.platformSpec,
      notebookFileName: '06_colab_kaggle_music_video.ipynb',
      hasMidi: true,
      providerSummary: pack.providerSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build Music & Video pack' },
      { status: 400 }
    );
  }
}
