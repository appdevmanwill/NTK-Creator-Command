import { generateWithRouter } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { extractJsonFromText, slugify } from '@/lib/utils';
import {
  buildMusicVideoNotebook,
  CloudHostPlatform,
  ColabAudioEngine,
} from './colab-music-video-nb';
import { buildVocalGuideMidi } from './midi-writer';

export type MusicPlatformId =
  | 'GOOGLE_FLOW'
  | 'SUNO'
  | 'TREBLO'
  | 'ACE_STUDIO'
  | 'UDIO'
  | 'MUREKA'
  | 'RIFFUSION'
  | 'ELEVENLABS_MUSIC'
  | 'COLAB_KAGGLE_OPEN'
  | 'ALL_PLATFORMS_MASTER';

export type MusicProjectMode =
  | 'SINGLE_AUDIO_AND_VIDEO'
  | 'ALBUM_STREAM_PACK'
  | 'SCORE_FLOW_MOVIE';

export interface MusicStudioInput {
  platform: MusicPlatformId;
  mode: MusicProjectMode;
  cloudHost: CloudHostPlatform;
  colabEngine: ColabAudioEngine;
  title: string;
  theme: string;
  genre: string;
  mood: string;
  bpm: number;
  musicalKey: string;
  vocalMode: 'VOCAL' | 'INSTRUMENTAL';
  aspectRatio: '16:9' | '9:16';
  visualStyle: string;
  excludeTraits: string;
  customLyrics?: string;
  trackCount?: number;
  attachedMovieTitle?: string;
  attachedMovieScenes?: Array<{ sceneNumber: number; title: string; summary: string; shotCount: number }>;
}

export interface PlatformSpecSummary {
  id: MusicPlatformId;
  name: string;
  url: string;
  limitNote: string;
}

export const MUSIC_PLATFORMS: Record<MusicPlatformId, PlatformSpecSummary> = {
  GOOGLE_FLOW: {
    id: 'GOOGLE_FLOW',
    name: 'Google Flow Music (Lyria 3.5 + Veo)',
    url: 'https://labs.google/fx/tools/flow',
    limitNote: 'Natural layered audio prompt + Gemini AI Producer edits + Veo synced music video',
  },
  SUNO: {
    id: 'SUNO',
    name: 'Suno (v4.5 / v5 / v5.5+ Custom Mode)',
    url: 'https://suno.com',
    limitNote: 'Style <= 1,000 chars (front-loaded) · Exclude lowercase comma list · Lyrics <= 3,000 chars',
  },
  TREBLO: {
    id: 'TREBLO',
    name: 'Treblo (formerly Sonauto)',
    url: 'https://treblo.com',
    limitNote: 'Prompt + Tag Library + Custom Lyrics + Section-Swap & Extension cues',
  },
  ACE_STUDIO: {
    id: 'ACE_STUDIO',
    name: 'ACE Studio (AI Vocals + MIDI)',
    url: 'https://acestudio.ai',
    limitNote: 'Imports real binary .mid + syllable-aligned lyrics + pitch/vibrato/breathiness curves',
  },
  UDIO: {
    id: 'UDIO',
    name: 'Udio (5-Block + / Guidance)',
    url: 'https://udio.com',
    limitNote: '5-block compositional prompt + [Section] tags + 40-50% prompt strength',
  },
  MUREKA: {
    id: 'MUREKA',
    name: 'Mureka (v8–v9.5)',
    url: 'https://mureka.ai',
    limitNote: 'Production Brief <= 1,024 chars + Bracketed Lyrics <= 3,000 chars',
  },
  RIFFUSION: {
    id: 'RIFFUSION',
    name: 'Riffusion',
    url: 'https://riffusion.com',
    limitNote: 'Strict <= 120-char textural Vibe/Style tags + [Section] lyrics',
  },
  ELEVENLABS_MUSIC: {
    id: 'ELEVENLABS_MUSIC',
    name: 'ElevenLabs Music (v2 / v2.5)',
    url: 'https://elevenlabs.io',
    limitNote: 'Studio engineering terms + exact BPM + section composition plan (no artist names)',
  },
  COLAB_KAGGLE_OPEN: {
    id: 'COLAB_KAGGLE_OPEN',
    name: 'Free Cloud GPU (Colab / Kaggle)',
    url: 'https://colab.research.google.com',
    limitNote: 'ACE-Step 1.5 (T4 FP32 fix) / DiffRhythm / MusicGen-Medium -> real Audio + MP4 Video',
  },
  ALL_PLATFORMS_MASTER: {
    id: 'ALL_PLATFORMS_MASTER',
    name: 'All Platforms Master Bundle',
    url: 'https://labs.google/fx/tools/flow',
    limitNote: 'Outputs tailored prompts for ALL 8 platforms + Colab/Kaggle .ipynb + ACE Studio .mid',
  },
};

function clampText(raw: string, maxLen: number): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen - 1);
  const lastSep = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(' '));
  return (lastSep > Math.floor(maxLen * 0.6) ? cut.slice(0, lastSep) : cut).replace(/[,\s]+$/, '');
}

function cleanSunoExcludeList(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((part) => part.replace(/^(no|without|exclude|avoid)\s+/i, '').trim())
    .filter(Boolean)
    .join(', ');
  return clampText(cleaned || 'harsh clipping, muddy sub-bass, abrupt fade, robotic pitch artifacts', 1000);
}

interface GeneratedCreative {
  sonicBible: string;
  lyrics: string;
  audioCorePrompt: string;
  riffusionTags: string;
  videoHookPrompt: string;
  sceneVisualPrompts: string[];
  tracks: Array<{ num: number; title: string; moodBeat: string; key: string; bpm: number; durationSec: number; prompt: string }>;
}

function buildOfflineCreative(input: MusicStudioInput): GeneratedCreative {
  const trackTotal =
    input.mode === 'ALBUM_STREAM_PACK'
      ? Math.max(4, Math.min(12, input.trackCount ?? 8))
      : input.mode === 'SCORE_FLOW_MOVIE' && input.attachedMovieScenes?.length
      ? input.attachedMovieScenes.length
      : 1;

  const vocalDesc =
    input.vocalMode === 'VOCAL'
      ? 'expressive warm lead vocals with tight backing harmonies'
      : '100% instrumental, zero lead vocals, melodic lead motif carried by instruments';

  const audioCorePrompt = `${input.genre}, ${input.mood}, ${input.bpm} BPM, key of ${input.musicalKey}, ${vocalDesc}, rich analog warmth, crisp stereo master, ${input.theme}`;

  const lyrics =
    input.vocalMode === 'INSTRUMENTAL'
      ? `[Intro - Atmospheric Pad & Motif]\n\n[Verse 1 - Groove Entry at ${input.bpm} BPM]\n\n[Chorus - Full Harmonic Lift]\n\n[Bridge - Stripped Percussion Break]\n\n[Outro - Clean Resolve]\n[End]`
      : input.customLyrics?.trim()
      ? input.customLyrics.trim()
      : [
          `[Intro - ${input.genre} Groove at ${input.bpm} BPM]`,
          ``,
          `[Verse 1]`,
          `[Close-mic storytelling]`,
          `Walking through the city with ${input.theme.slice(0, 64)}`,
          `Every quiet step builds the fire inside my chest`,
          `Hold the line steady when the heavy shadows fall`,
          `We turn the late-night hustle into gold`,
          ``,
          `[Pre-Chorus]`,
          `Hear the bassline rising in ${input.musicalKey}`,
          `Nothing handed out, we earn every bar`,
          ``,
          `[Chorus | Anthemic ${input.genre} | Layered Harmonies | Punchy Low-End]`,
          `${input.title} — let the whole room feel the sound`,
          `From the bottom of the road to the skyline crown`,
          `(Skyline crown!)`,
          `No retreat when the spotlight hits the floor`,
          `We came to build a legacy that lasts forevermore`,
          ``,
          `[Bridge | Half-Time Feel | Atmospheric Reverb]`,
          `[Whisper]`,
          `Breathe through the pressure, stay true to the craft`,
          `[Belting]`,
          `Now drop the beat back in!`,
          ``,
          `[Outro - Clean Instrumental Tail]`,
          `[End]`,
        ].join('\n');

  const riffusionTags = clampText(
    `${input.genre}, ${input.mood}, ${input.bpm} bpm, ${input.vocalMode === 'VOCAL' ? 'soulful vocal' : 'instrumental'}, warm analog`,
    120
  );

  const sceneVisualPrompts =
    input.mode === 'SCORE_FLOW_MOVIE' && input.attachedMovieScenes?.length
      ? input.attachedMovieScenes.map(
          (sc) =>
            `${input.aspectRatio} cinematic scene ${sc.sceneNumber} (${sc.title}): ${sc.summary}. Visual style: ${input.visualStyle}.`
        )
      : [
          `${input.aspectRatio} opening hook frame: ${input.visualStyle}, introducing "${input.title}" (${input.theme}), slow push-in matched to ${input.bpm} BPM.`,
          `${input.aspectRatio} verse visual beat: atmospheric storytelling moment highlighting ${input.mood} energy, shallow depth of field.`,
          `${input.aspectRatio} chorus climax shot: bold dynamic camera sweep synced to snare hits, rich lighting in ${input.visualStyle}.`,
          `${input.aspectRatio} outro visual resolve: clean calm composition leaving space for end-card and subscribe CTA.`,
        ];

  const tracks = Array.from({ length: trackTotal }, (_, idx) => {
    const num = idx + 1;
    const sc = input.attachedMovieScenes?.[idx];
    const trackTitle = sc
      ? `Cue ${String(num).padStart(2, '0')} — ${sc.title}`
      : trackTotal === 1
      ? input.title
      : `${input.title} · Movement ${String(num).padStart(2, '0')}`;
    const bpmShift = trackTotal === 1 ? input.bpm : Math.max(68, Math.min(165, input.bpm + ((idx % 3) - 1) * 4));
    const dur = sc ? Math.max(30, sc.shotCount * 8) : input.mode === 'ALBUM_STREAM_PACK' ? 175 + (idx % 4) * 15 : 150;
    const moodBeat = sc ? sc.summary : `${input.mood} chapter ${num} exploring ${input.theme}`;
    return {
      num,
      title: trackTitle,
      moodBeat,
      key: input.musicalKey,
      bpm: bpmShift,
      durationSec: dur,
      prompt: `${input.genre}, ${moodBeat}, ${bpmShift} BPM, key of ${input.musicalKey}, ${vocalDesc}, cohesive stereo master`,
    };
  });

  return {
    sonicBible: `- **Core Genre & Tempo:** ${input.genre} @ ${input.bpm} BPM (${input.musicalKey})\n- **Vocal Profile:** ${vocalDesc}\n- **Visual Continuity:** ${input.visualStyle} (${input.aspectRatio})\n- **Negative / Exclude:** ${input.excludeTraits}`,
    lyrics,
    audioCorePrompt,
    riffusionTags,
    videoHookPrompt: `${input.aspectRatio} music video for "${input.title}". ${input.visualStyle}. Rhythmic camera cuts and subtle motion synced to ${input.bpm} BPM (${input.mood} mood) telling the story of ${input.theme}.`,
    sceneVisualPrompts,
    tracks,
  };
}

function formatPlatformPromptSection(
  pid: Exclude<MusicPlatformId, 'ALL_PLATFORMS_MASTER'>,
  input: MusicStudioInput,
  creative: GeneratedCreative
): string {
  const sunoStyle = clampText(
    `${input.genre}, ${input.mood}, ${input.bpm} BPM, ${input.musicalKey}, ${
      input.vocalMode === 'VOCAL' ? 'expressive lead vocals, layered harmonies' : 'instrumental, no vocals'
    }, warm analog mix, ${input.theme}`,
    1000
  );
  const sunoExclude = cleanSunoExcludeList(
    input.vocalMode === 'INSTRUMENTAL' ? `vocals, singing, rap, ${input.excludeTraits}` : input.excludeTraits
  );
  const sunoLyrics = clampText(creative.lyrics, 3000);
  const murekaBrief = clampText(
    `${input.genre} · Emotion: ${input.mood} · Rhythm: ${input.bpm} BPM in ${input.musicalKey} · Vocals: ${
      input.vocalMode === 'VOCAL' ? 'Lead + harmonies' : 'Instrumental only'
    } · Core Idea: ${input.theme} · Mix: warm punchy stereo master`,
    1024
  );

  switch (pid) {
    case 'GOOGLE_FLOW':
      return `## Google Flow Music (Lyria 3.5) + Veo Music Video
- **URL:** https://labs.google/fx/tools/flow

### Box 1 — Primary Flow Music Prompt (Lyria 3.5)
\`\`\`text
${creative.audioCorePrompt}
\`\`\`

### Box 2 — Lyrics / Structure (Paste if Vocals Selected)
\`\`\`text
${creative.lyrics}
\`\`\`

### Box 3 — Gemini AI Producer Follow-Up Prompts (Iterate in Flow Chat)
1. \`Tighten the low-end groove at ${input.bpm} BPM and add richer stereo warmth in the chorus.\`
2. \`Keep the main melody motif in ${input.musicalKey}, strip back the bridge for tension, then hit full energy on the final chorus.\`
3. \`Extend the outro by 15 seconds with a clean, non-abrupt fade-out suitable for video editing.\`

### Box 4 — Companion Flow Video (Veo) Synced Music Video Prompts
\`\`\`text
${creative.videoHookPrompt}
\`\`\`
${creative.sceneVisualPrompts.map((p, i) => `${i + 1}. \`${p}\``).join('\n')}

### Optional: Official Python Gemini API Snippet (\`lyria-3.5\`)
\`\`\`python
from google import genai
client = genai.Client()
interaction = client.interactions.create(
    model="lyria-3.5",
    input=${JSON.stringify(creative.audioCorePrompt)},
)
\`\`\``;

    case 'SUNO':
      return `## Suno (v4.5 / v5 / v5.5+ Custom Mode)
- **URL:** https://suno.com (Switch **Custom Mode ON**)

### 1. Song Title
\`\`\`text
${clampText(input.title, 100)}
\`\`\`

### 2. Style of Music Box (${sunoStyle.length}/1000 chars — Front-Loaded, Zero Artist Names)
\`\`\`text
${sunoStyle}
\`\`\`

### 3. Exclude Styles Box (${sunoExclude.length}/1000 chars — Lowercase Comma List, No "no" Prefix)
\`\`\`text
${sunoExclude}
\`\`\`

### 4. Custom Lyrics Box (${sunoLyrics.length}/3000 sweet-spot chars)
\`\`\`text
${sunoLyrics}
\`\`\``;

    case 'TREBLO':
      return `## Treblo (formerly Sonauto)
- **URL:** https://treblo.com (Mobile & Web)

### Simple / Advanced Prompt
\`\`\`text
${creative.audioCorePrompt}
\`\`\`

### Tag Library Picks (Enter in Treblo Tag Selector)
\`${input.genre}\`, \`${input.mood}\`, \`${input.bpm} BPM\`, \`${input.musicalKey}\`, \`${
        input.vocalMode === 'VOCAL' ? 'lead vocals, vocal harmonies' : 'instrumental'
      }\`, \`analog warmth\`

### Custom Lyrics
\`\`\`text
${creative.lyrics}
\`\`\`

### Section-Swap / Extension Prompts
- \`Extend intro by 8 bars with atmospheric build.\`
- \`Swap Chorus vocals for higher emotional intensity while keeping the exact percussion pocket.\``;

    case 'ACE_STUDIO':
      return `## ACE Studio (Hyper-Realistic AI Vocals + Real MIDI)
- **URL:** https://acestudio.ai
- **Included Binary File:** \`07_ace_studio_melody_guide.mid\` (${input.bpm} BPM, ${input.musicalKey})

### Step-by-Step ACE Studio Import
1. Drag \`07_ace_studio_melody_guide.mid\` onto an **AI Singer track** inside ACE Studio (or stream via **ACE Bridge** VST3/AU/AAX in FL Studio / Ableton / Logic).
2. Double-click the MIDI clip and paste the clean lyrics below (ACE Studio aligns syllables automatically):

\`\`\`text
${creative.lyrics
  .split('\n')
  .filter((l) => l.trim() && !l.trim().startsWith('['))
  .join('\n')}
\`\`\`

### Expression & Timbre Tuning Guide
- **Verse:** Breathiness +18%, moderate vibrato, slight human timing offset (-10ms to +15ms) for natural phrasing.
- **Chorus:** Chest/Power timbre +35%, add a second harmony singer track (+3rd/+5th) panned 25% L/R.
- **Bridge:** Airy/Whisper timbre, reduce tension, swell pitch glide into the final chorus.`;

    case 'UDIO':
      return `## Udio (5-Block Compositional Prompt)
- **URL:** https://udio.com
- **Recommended Prompt Strength:** \`45%\` (allows musical breathing room)

### 5-Block Prompt
\`\`\`text
Genre: ${input.genre} | Mood: ${input.mood} | Instrumentation: warm bass, crisp drums, melodic keys/lead | Vocals: ${
        input.vocalMode === 'VOCAL' ? 'emotive lead vocal with harmonies' : 'instrumental only'
      } | Production: studio stereo master, ${input.bpm} BPM, ${input.musicalKey}
\`\`\`

### Custom Lyrics (Use \`/\` in Udio editor for inline Guidance Tags)
\`\`\`text
${creative.lyrics}
\`\`\``;

    case 'MUREKA':
      return `## Mureka (v8 – v9.5)
- **URL:** https://mureka.ai

### Production Brief (${murekaBrief.length}/1024 chars)
\`\`\`text
${murekaBrief}
\`\`\`

### Custom Lyrics Box (${sunoLyrics.length}/3000 chars)
\`\`\`text
${sunoLyrics}
\`\`\``;

    case 'RIFFUSION':
      return `## Riffusion
- **URL:** https://riffusion.com

### Vibe / Style Box (${creative.riffusionTags.length}/120 chars — Strictly Under 120 Chars)
\`\`\`text
${creative.riffusionTags}
\`\`\`

### Custom Lyrics Box
\`\`\`text
${creative.lyrics}
\`\`\``;

    case 'ELEVENLABS_MUSIC':
      return `## ElevenLabs Music (v2 / v2.5)
- **URL:** https://elevenlabs.io

### Studio Production Prompt (No Copyrighted Artist Names)
\`\`\`text
${input.genre}, ${input.mood}, exact tempo ${input.bpm} BPM in ${input.musicalKey}. Studio engineering: close-mic'd transients, subtle tape saturation, sidechained low-end, wide plate reverb on snare, crisp mastered stereo image. ${
        input.vocalMode === 'VOCAL' ? 'Expressive lead vocal sitting cleanly above the mix.' : 'Instrumental arrangement only.'
      } Theme: ${input.theme}.
\`\`\`

### Section-by-Section Composition Plan (Use \`+ Add Section\` for up to 10 min)
1. **Intro (0:00–0:20):** Filtered atmospheric motif establishing ${input.musicalKey} at ${input.bpm} BPM.
2. **Verse (0:20–0:55):** Tight rhythm pocket, intimate arrangement leaving space for storytelling.
3. **Chorus (0:55–1:30):** Full harmonic bloom, punchy drums, wide stereo layers.
4. **Outro (1:30–2:15):** Gradual strip-back and clean studio decay.`;

    case 'COLAB_KAGGLE_OPEN':
      return `## Free Open-Source Cloud GPU (Google Colab / Kaggle)
- **Included Notebook:** \`06_colab_kaggle_music_video.ipynb\` (valid \`nbformat 4\`)
- **Engine:** \`${input.colabEngine}\` (with Tesla T4 \`float32\` NaN fix + beat-synced MP4 video rendering + \`-14 LUFS\` mastering)
- Upload \`06_colab_kaggle_music_video.ipynb\` to **Google Colab** (T4 GPU) or **Kaggle** (GPU T4 x2 + Internet ON) and run Cells 1..6 sequentially to download \`ntk_cloud_gpu_output.zip\` containing \`master_14lufs.mp3\`, \`captions.srt\`, and \`ntk_music_video_final.mp4\`.`;
  }
}

export async function buildMusicVideoStudioPack(input: MusicStudioInput) {
  let creative = buildOfflineCreative(input);
  let providerSummary = 'Offline Music & Video Engine';

  try {
    const res = await generateWithRouter({
      taskType: 'long_context',
      prompt: `Create a cohesive Audio + Music Video production blueprint for "${input.title}".
Genre: ${input.genre} | Mood: ${input.mood} | BPM: ${input.bpm} | Key: ${input.musicalKey}
Vocal Mode: ${input.vocalMode} | Aspect Ratio: ${input.aspectRatio}
Theme/Story: ${input.theme}
Visual Style: ${input.visualStyle}

Return STRICT JSON ONLY:
{
  "audioCorePrompt": "Rich layered audio prompt without real artist names",
  "riffusionTags": "Strictly under 115 chars comma-separated vibe tags",
  "lyrics": "${input.vocalMode === 'INSTRUMENTAL' ? '[Intro]\\n[Verse]\\n[Chorus]\\n[Outro]' : 'Original lyrics with [Intro], [Verse 1], [Pre-Chorus], [Chorus | Energy | Instruments], [Bridge], [Outro], [End] tags'}",
  "videoHookPrompt": "Cohesive ${input.aspectRatio} music video prompt synced to ${input.bpm} BPM",
  "sceneVisualPrompts": ["Scene 1 visual prompt", "Scene 2 visual prompt", "Scene 3 visual prompt", "Scene 4 visual prompt"]
}`,
      jsonMode: true,
      maxOutputTokens: 3072,
    });

    const parsed = extractJsonFromText<Partial<GeneratedCreative>>(res.text);
    if (parsed.audioCorePrompt) creative.audioCorePrompt = parsed.audioCorePrompt;
    if (parsed.riffusionTags) creative.riffusionTags = clampText(parsed.riffusionTags, 120);
    if (parsed.lyrics && !input.customLyrics?.trim()) creative.lyrics = parsed.lyrics;
    if (parsed.videoHookPrompt) creative.videoHookPrompt = parsed.videoHookPrompt;
    if (Array.isArray(parsed.sceneVisualPrompts) && parsed.sceneVisualPrompts.length >= 2) {
      creative.sceneVisualPrompts = parsed.sceneVisualPrompts.slice(0, 6);
    }
    providerSummary = `${res.provider}/${res.model}`;
  } catch (err) {
    if (!(err instanceof AllKeysExhaustedError)) {
      // keep deterministic offline creative on transient parser errors too
    }
  }

  const allSinglePlatforms: Array<Exclude<MusicPlatformId, 'ALL_PLATFORMS_MASTER'>> = [
    'GOOGLE_FLOW',
    'SUNO',
    'TREBLO',
    'ACE_STUDIO',
    'UDIO',
    'MUREKA',
    'RIFFUSION',
    'ELEVENLABS_MUSIC',
    'COLAB_KAGGLE_OPEN',
  ];

  const selectedPlatformSections =
    input.platform === 'ALL_PLATFORMS_MASTER'
      ? allSinglePlatforms.map((p) => formatPlatformPromptSection(p, input, creative)).join('\n\n---\n\n')
      : [
          formatPlatformPromptSection(input.platform, input, creative),
          input.platform !== 'GOOGLE_FLOW'
            ? `\n---\n\n${formatPlatformPromptSection('GOOGLE_FLOW', input, creative)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

  const copyPasteMasterPrompt = `# ${input.title} — Complete Copy-Paste Audio + Video Workflow
**Mode:** ${input.mode} | **Genre:** ${input.genre} | **BPM:** ${input.bpm} | **Key:** ${input.musicalKey} | **Video:** ${input.aspectRatio}

${selectedPlatformSections}

---

## Companion Video Storyboard (4-Beat Synced Visuals for Veo / Flow / SDXL)
${creative.sceneVisualPrompts.map((p, i) => `### Scene ${String(i + 1).padStart(2, '0')}\n\`\`\`text\n${p}\n\`\`\``).join('\n\n')}
`;

  const tracklistLines = creative.tracks
    .map((t) => `| ${String(t.num).padStart(2, '0')} | ${t.title} | ${t.bpm} | ${t.key} | ${t.durationSec}s | ${t.prompt} |`)
    .join('\n');

  let cursorSec = 0;
  const chapterLines = creative.tracks.map((t) => {
    const mm = String(Math.floor(cursorSec / 60)).padStart(2, '0');
    const ss = String(cursorSec % 60).padStart(2, '0');
    cursorSec += t.durationSec;
    return `${mm}:${ss} ${t.title}`;
  });

  const slug = slugify(input.title, 'music-pack');
  const width = input.aspectRatio === '9:16' ? 720 : 1280;
  const height = input.aspectRatio === '9:16' ? 1280 : 720;

  const bashScript = `#!/usr/bin/env bash
set -e
# Local CPU-Friendly Audio Master (-14 LUFS) + Beat-Synced Video Assembly
# Place raw_audio.mp3/wav and scene_01.mp4.. or scene_01.png.. in this folder.
mkdir -p mastered
AUDIO_IN="\${1:-raw_audio.mp3}"
ffmpeg -y -i "$AUDIO_IN" -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a libmp3lame -b:a 320k "mastered/${slug}_14lufs.mp3"
if ls scene_*.mp4 >/dev/null 2>&1; then
  printf "file '%s'\\n" scene_*.mp4 > concat.txt
  ffmpeg -y -f concat -safe 0 -i concat.txt -i "mastered/${slug}_14lufs.mp3" -map 0:v -map 1:a -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k -shortest "mastered/${slug}_final.mp4"
elif ls scene_*.png >/dev/null 2>&1; then
  ffmpeg -y -framerate 0.25 -pattern_type glob -i "scene_*.png" -i "mastered/${slug}_14lufs.mp3" -vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}" -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "mastered/${slug}_final.mp4"
fi
echo "Done! Check ./mastered/"
`;

  const psScript = `$ErrorActionPreference = 'Stop'
# Windows PowerShell Local Audio Master (-14 LUFS) + Video Assembly
param([string]$AudioIn = "raw_audio.mp3")
New-Item -ItemType Directory -Path "mastered" -Force | Out-Null
ffmpeg -y -i $AudioIn -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a libmp3lame -b:a 320k "mastered\\${slug}_14lufs.mp3"
$clips = Get-ChildItem -Filter "scene_*.mp4" | Sort-Object Name
if ($clips.Count -gt 0) {
  $clips | ForEach-Object { "file '$($_.FullName)'" } | Set-Content "concat.txt" -Encoding ASCII
  ffmpeg -y -f concat -safe 0 -i concat.txt -i "mastered\\${slug}_14lufs.mp3" -map 0:v -map 1:a -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 192k -shortest "mastered\\${slug}_final.mp4"
}
Write-Host "Mastered audio & video saved under .\\mastered\\"
`;

  const targetUrl = MUSIC_PLATFORMS[input.platform].url;
  const agentPlaybook = `# Autonomous Agent Playbook — Google Antigravity & OpenAI Codex

## Environment Rules
- **Browser:** BrowserOS neo using profile **\`FEAICCWS\`**
- **Safety:** Keep **Turbo Mode OFF**. Always audition generated audio before downloading and check for cutoffs or distortion.
- **Primary Target:** ${MUSIC_PLATFORMS[input.platform].name} (${targetUrl})

## Execution Steps
1. Open ${targetUrl} in BrowserOS neo (\`FEAICCWS\`).
2. Read \`01_COPY_PASTE_COMPLETE_WORKFLOW.md\` and copy the exact boxes for the target platform.
3. If using **ACE Studio**, import \`07_ace_studio_melody_guide.mid\` and paste lyrics from \`03_LYRICS_AND_TRACKLIST.md\`.
4. Generate Track 01 first as an audition check; save audio into \`./raw_audio/\`.
5. Open **Google Flow** (\`https://labs.google/fx/tools/flow\`) to generate matching \`${input.aspectRatio}\` video clips from \`02_VIDEO_STORYBOARD.md\`, or run \`06_colab_kaggle_music_video.ipynb\` on free **${input.cloudHost}** GPU for zero-cost automated rendering.
6. Run \`assemble_music_video.ps1\` (Windows) or \`assemble_music_video.sh\` (Linux/Mac) to normalize audio to \`-14 LUFS\` and mux final MP4.
`;

  const notebookJson = buildMusicVideoNotebook({
    title: input.title,
    platform: input.cloudHost,
    engine: input.colabEngine,
    audioPrompt: creative.audioCorePrompt,
    lyrics: creative.lyrics,
    bpm: input.bpm,
    aspectRatio: input.aspectRatio,
    visualStyle: input.visualStyle,
    sceneVisualPrompts: creative.sceneVisualPrompts,
    vocalMode: input.vocalMode,
    durationSeconds: 24,
  });

  const midiBuffer = buildVocalGuideMidi({
    title: input.title,
    bpm: input.bpm,
    musicalKey: input.musicalKey,
    bars: 8,
  });

  const textFiles = [
    {
      path: 'README.md',
      content: `# ${input.title} — Multi-Platform Music & Video Production Pack\n\n- **Primary Platform:** ${MUSIC_PLATFORMS[input.platform].name}\n- **Project Mode:** ${input.mode}\n- **Cloud GPU Engine:** ${input.cloudHost} (${input.colabEngine})\n- **Tempo & Key:** ${input.bpm} BPM · ${input.musicalKey}\n- **Video Format:** ${input.aspectRatio}\n\n## Sonic Continuity Bible\n${creative.sonicBible}\n\n## What's Inside\n- \`01_COPY_PASTE_COMPLETE_WORKFLOW.md\` — Ready-to-paste prompts obeying exact platform character limits\n- \`02_VIDEO_STORYBOARD.md\` — Beat-synced visual prompts for Google Flow / Veo / SDXL\n- \`03_LYRICS_AND_TRACKLIST.md\` — Structured lyrics & multi-track cue table\n- \`04_AGENT_PLAYBOOK_ANTIGRAVITY_CODEX.md\` — Antigravity + OpenAI Codex browser execution guide\n- \`05_AUDIO_MASTER_AND_VIDEO_FFMPEG.md\` — CPU-friendly mastering (\`-14 LUFS\`) & video assembly guide\n- \`06_colab_kaggle_music_video.ipynb\` — Verified working Colab/Kaggle notebook (Audio + MP4 Video)\n- \`07_ace_studio_melody_guide.mid\` — Real Standard MIDI vocal guide for ACE Studio / DAWs\n- \`08_youtube_chapters_and_release_kit.txt\` — Ready-to-paste chapters & upload notes\n`,
    },
    { path: '01_COPY_PASTE_COMPLETE_WORKFLOW.md', content: copyPasteMasterPrompt },
    {
      path: '02_VIDEO_STORYBOARD.md',
      content: `# Music Video Storyboard (${input.aspectRatio} · ${input.bpm} BPM)\n\n## Master Visual Direction\n${creative.videoHookPrompt}\n\n## Ordered Scenes\n${creative.sceneVisualPrompts.map((p, i) => `### Scene ${String(i + 1).padStart(2, '0')}\n${p}`).join('\n\n')}\n`,
    },
    {
      path: '03_LYRICS_AND_TRACKLIST.md',
      content: `# Lyrics & Tracklist — ${input.title}\n\n## Master Lyrics / Arrangement\n\`\`\`text\n${creative.lyrics}\n\`\`\`\n\n## Track / Cue Matrix\n| # | Title | BPM | Key | Duration | Prompt |\n| --- | --- | --- | --- | --- | --- |\n${tracklistLines}\n`,
    },
    { path: '04_AGENT_PLAYBOOK_ANTIGRAVITY_CODEX.md', content: agentPlaybook },
    {
      path: '05_AUDIO_MASTER_AND_VIDEO_FFMPEG.md',
      content: `# Audio Mastering (-14 LUFS) & Video Assembly\n\n1. **Windows:** Run \`powershell -ExecutionPolicy Bypass -File assemble_music_video.ps1 -AudioIn raw_audio.mp3\`\n2. **Linux / macOS:** Run \`chmod +x assemble_music_video.sh && ./assemble_music_video.sh raw_audio.mp3\`\n\n## Voiceover Ducking (For Flow Movie Scoring)\n\`\`\`bash\nffmpeg -i voiceover.mp3 -i music_14lufs.mp3 -filter_complex "[1:a]volume=0.22[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map "[aout]" -c:a aac -b:a 192k mixed_audio.m4a\n\`\`\`\n`,
    },
    { path: '06_colab_kaggle_music_video.ipynb', content: notebookJson },
    {
      path: '08_youtube_chapters_and_release_kit.txt',
      content: `TITLE IDEAS:\n- ${input.title} (${input.genre} · Official Audio & Visual)\n- ${input.title} | ${input.mood} ${input.genre} Session (${input.bpm} BPM)\n\nCHAPTERS:\n${chapterLines.join('\n')}\n`,
    },
    { path: 'assemble_music_video.sh', content: bashScript },
    { path: 'assemble_music_video.ps1', content: psScript },
  ];

  const triggerPrompts = [
    {
      label: 'Google Antigravity (End-to-End Music + Video)',
      prompt: `Open BrowserOS neo using profile FEAICCWS. Follow 04_AGENT_PLAYBOOK_ANTIGRAVITY_CODEX.md for "${input.title}": paste the prompts from 01_COPY_PASTE_COMPLETE_WORKFLOW.md into ${MUSIC_PLATFORMS[input.platform].name} (${targetUrl}) with Turbo Mode OFF, audition Track 1, download audio to ./raw_audio/, generate ${input.aspectRatio} visuals in Google Flow (or run 06_colab_kaggle_music_video.ipynb on ${input.cloudHost}), and run assemble_music_video.ps1.`,
    },
    {
      label: 'OpenAI Codex (Autonomous Cloud/Local Pipeline)',
      prompt: `Read 01_COPY_PASTE_COMPLETE_WORKFLOW.md, 05_AUDIO_MASTER_AND_VIDEO_FFMPEG.md, and 06_colab_kaggle_music_video.ipynb. Execute the ${input.colabEngine} audio + beat-synced MP4 pipeline (or automate ${MUSIC_PLATFORMS[input.platform].name} via BrowserOS neo FEAICCWS), verify non-empty audio + MP4 outputs, normalize to -14 LUFS, and save final release assets.`,
    },
    {
      label: 'Quick Audition (Track 1 Smoke Check)',
      prompt: `Use BrowserOS neo (profile FEAICCWS, Turbo Mode OFF) on ${targetUrl}. Generate ONLY Track 01 from 01_COPY_PASTE_COMPLETE_WORKFLOW.md, check tempo (${input.bpm} BPM) and vocal clarity before running remaining tracks.`,
    },
  ];

  return {
    textFiles,
    binaryFiles: [{ path: '07_ace_studio_melody_guide.mid', buffer: midiBuffer }],
    copyPasteMasterPrompt,
    triggerPrompts,
    providerSummary,
    platformSpec: MUSIC_PLATFORMS[input.platform],
  };
}
