import JSZip from 'jszip';
import { extractJsonSafe, generateMobileAI } from './ai-router';
import { slugifyName } from './generators';
import { buildMobileVocalGuideMidi } from './midi-writer';

export type MobileMusicPlatform =
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

export interface MobileMusicInput {
  platform: MobileMusicPlatform;
  cloudHost: 'COLAB' | 'KAGGLE';
  colabEngine: 'ACE_STEP_1_5' | 'DIFFRHYTHM' | 'MUSICGEN_MEDIUM';
  title: string;
  theme: string;
  genre: string;
  mood: string;
  bpm: number;
  musicalKey: string;
  vocalMode: 'VOCAL' | 'INSTRUMENTAL';
  aspectRatio: '16:9' | '9:16';
  excludeTraits: string;
  customLyrics?: string;
}

const PLATFORM_NAMES: Record<MobileMusicPlatform, { name: string; url: string }> = {
  GOOGLE_FLOW: { name: 'Google Flow Music (Lyria 3.5 + Veo)', url: 'https://labs.google/fx/tools/flow' },
  SUNO: { name: 'Suno (v4.5 / v5 / v5.5+ Custom Mode)', url: 'https://suno.com' },
  TREBLO: { name: 'Treblo (formerly Sonauto)', url: 'https://treblo.com' },
  ACE_STUDIO: { name: 'ACE Studio (AI Vocals + MIDI)', url: 'https://acestudio.ai' },
  UDIO: { name: 'Udio (5-Block + / Guidance)', url: 'https://udio.com' },
  MUREKA: { name: 'Mureka (v8–v9.5)', url: 'https://mureka.ai' },
  RIFFUSION: { name: 'Riffusion', url: 'https://riffusion.com' },
  ELEVENLABS_MUSIC: { name: 'ElevenLabs Music (v2 / v2.5)', url: 'https://elevenlabs.io' },
  COLAB_KAGGLE_OPEN: { name: 'Free Cloud GPU (Colab / Kaggle)', url: 'https://colab.research.google.com' },
  ALL_PLATFORMS_MASTER: { name: 'All Platforms Master Pack', url: 'https://labs.google/fx/tools/flow' },
};

function clampText(raw: string, maxLen: number): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen - 1);
  const lastSep = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(' '));
  return (lastSep > Math.floor(maxLen * 0.6) ? cut.slice(0, lastSep) : cut).replace(/[,\s]+$/, '');
}

function cleanSunoExclude(raw: string): string {
  return clampText(
    raw
      .toLowerCase()
      .split(/[,;\n]+/)
      .map((s) => s.replace(/^(no|without|exclude|avoid)\s+/i, '').trim())
      .filter(Boolean)
      .join(', ') || 'harsh clipping, muddy low end, abrupt fade',
    1000
  );
}

function cellMd(source: string) {
  const lines = source.split('\n');
  return {
    cell_type: 'markdown',
    metadata: {},
    source: lines.map((l, i) => (i < lines.length - 1 ? `${l}\n` : l)),
  };
}

function cellCode(source: string) {
  const lines = source.split('\n');
  return {
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: lines.map((l, i) => (i < lines.length - 1 ? `${l}\n` : l)),
  };
}

function buildMobileColabNotebook(params: {
  title: string;
  cloudHost: 'COLAB' | 'KAGGLE';
  engine: 'ACE_STEP_1_5' | 'DIFFRHYTHM' | 'MUSICGEN_MEDIUM';
  audioPrompt: string;
  lyrics: string;
  bpm: number;
  aspectRatio: '16:9' | '9:16';
  vocalMode: 'VOCAL' | 'INSTRUMENTAL';
  scenePrompts: string[];
}): string {
  const nb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3.10.12' },
      accelerator: 'GPU',
      colab: { provenance: [], gpuType: 'T4' },
    },
    cells: [
      cellMd(
        `# ${params.title} — End-to-End Free Cloud GPU Audio + Video Pipeline\n\nHost: **${params.cloudHost}** (Enable T4/P100 GPU; turn Internet ON on Kaggle). Generates \`master_14lufs.mp3\`, \`captions.srt\`, and \`ntk_music_video_final.mp4\`.`
      ),
      cellCode(`# 1. Verify Free Cloud GPU (T4 / P100)
!nvidia-smi
import torch
print("CUDA available:", torch.cuda.is_available())`),
      cellCode(`# 2. Install Audio, Video & Caption Dependencies
!apt-get update -qq && apt-get install -y -qq ffmpeg espeak-ng > /dev/null
!pip install -q --upgrade git+https://github.com/huggingface/diffusers.git transformers accelerate soundfile scipy librosa edge-tts gTTS pillow sentencepiece`),
      cellCode(`# 3. Pre-Filled Production Parameters
PROJECT_TITLE = ${JSON.stringify(params.title)}
AUDIO_PROMPT = ${JSON.stringify(params.audioPrompt)}
LYRICS_TEXT = ${JSON.stringify(params.lyrics)}
BPM = ${params.bpm}
ASPECT_RATIO = ${JSON.stringify(params.aspectRatio)}
VOCAL_MODE = ${JSON.stringify(params.vocalMode)}
ENGINE = ${JSON.stringify(params.engine)}
SCENE_PROMPTS = ${JSON.stringify(params.scenePrompts)}
print("Loaded:", PROJECT_TITLE, "| Engine:", ENGINE)`),
      cellCode(`# 4. Generate Full Audio (ACE-Step 1.5 with Tesla T4 FP32 NaN Fix + MusicGen-Medium Fallback)
import asyncio, os, shutil, subprocess, torch
import numpy as np
import soundfile as sf

os.makedirs("outputs", exist_ok=True)
raw_wav = "outputs/master_raw.wav"

if torch.cuda.is_available() and torch.cuda.get_device_capability(0)[0] < 8:
    os.environ["ACESTEP_DTYPE"] = "float32"
    torch.set_default_dtype(torch.float32)
    DTYPE = torch.float32
else:
    DTYPE = torch.bfloat16 if torch.cuda.is_available() else torch.float32

ace_ok = False
if ENGINE == "ACE_STEP_1_5":
    try:
        from diffusers import AceStepPipeline
        pipe = AceStepPipeline.from_pretrained("ACE-Step/acestep-v15-xl-turbo-diffusers", torch_dtype=DTYPE)
        if torch.cuda.is_available():
            pipe.enable_model_cpu_offload()
        if hasattr(pipe, "vae") and hasattr(pipe.vae, "enable_tiling"):
            pipe.vae.enable_tiling()
        out = pipe(prompt=AUDIO_PROMPT, lyrics=LYRICS_TEXT if VOCAL_MODE == "VOCAL" else "[Instrumental]", audio_duration=24.0, num_inference_steps=12, guidance_scale=3.5)
        audio = out.audios[0].detach().cpu().float().numpy()
        if not np.isnan(audio).any() and float(np.max(np.abs(audio))) >= 1e-4:
            sf.write(raw_wav, audio.T if audio.ndim == 2 else audio, pipe.sample_rate)
            ace_ok = True
    except Exception as exc:
        print("ACE-Step note (switching to MusicGen-Medium fallback):", exc)

if not ace_ok:
    import scipy.io.wavfile
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    device = "cuda" if torch.cuda.is_available() else "cpu"
    proc = AutoProcessor.from_pretrained("facebook/musicgen-medium")
    mdl = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-medium").to(device)
    inp = proc(text=[AUDIO_PROMPT], padding=True, return_tensors="pt").to(device)
    vals = mdl.generate(**inp, max_new_tokens=900)
    sr = mdl.config.audio_encoder.sampling_rate
    arr = vals[0, 0].detach().cpu().float().numpy()
    arr = arr / max(1e-6, float(np.max(np.abs(arr)))) * 0.85
    scipy.io.wavfile.write("outputs/_inst.wav", rate=sr, data=(arr * 32767).astype(np.int16))
    lines = [ln.strip() for ln in LYRICS_TEXT.splitlines() if ln.strip() and not ln.strip().startswith("[")]
    if VOCAL_MODE == "VOCAL" and lines:
        from gtts import gTTS
        gTTS(text=" ... ".join(lines[:6]), lang="en").save("outputs/_voc.mp3")
        subprocess.run(["ffmpeg", "-y", "-i", "outputs/_inst.wav", "-i", "outputs/_voc.mp3", "-filter_complex", "[0:a]volume=0.55[bg];[1:a]volume=1.15[v];[bg][v]amix=inputs=2:duration=first[out]", "-map", "[out]", raw_wav], check=True)
    else:
        shutil.copy("outputs/_inst.wav", raw_wav)

assert os.path.exists(raw_wav) and os.path.getsize(raw_wav) > 1000`),
      cellCode(`# 5. Master -14 LUFS Audio + Render Beat-Synced MP4 Music Video
import glob, os, subprocess, textwrap
import librosa
from PIL import Image, ImageDraw

os.makedirs("outputs/frames", exist_ok=True)
master_mp3 = "outputs/master_14lufs.mp3"
subprocess.run(["ffmpeg", "-y", "-i", "outputs/master_raw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-codec:a", "libmp3lame", "-b:a", "320k", master_mp3], check=True)
y_a, sr_a = librosa.load(master_mp3, sr=22050, mono=True)
dur = float(librosa.get_duration(y=y_a, sr=sr_a))
w, h = (720, 1280) if ASPECT_RATIO == "9:16" else (1280, 720)
frames = []
for idx, vp in enumerate(SCENE_PROMPTS[:4]):
    p = f"outputs/frames/scene_{idx+1:02d}.png"
    im = Image.new("RGB", (w, h), (17, 17, 21))
    d = ImageDraw.Draw(im)
    d.rectangle([24, 24, w - 24, h - 24], outline=(212, 175, 55), width=3)
    d.multiline_text((48, h // 3), textwrap.fill(f"{PROJECT_TITLE}\\n\\n{vp}", width=34), fill=(245, 241, 232), spacing=8)
    im.save(p)
    frames.append(p)
seg = max(3.0, dur / max(1, len(frames)))
clips = []
for idx, fp in enumerate(frames):
    cp = f"outputs/frames/clip_{idx+1:02d}.mp4"
    subprocess.run(["ffmpeg", "-y", "-loop", "1", "-i", fp, "-t", f"{seg:.2f}", "-r", "24", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", cp], check=True)
    clips.append(cp)
with open("outputs/concat.txt", "w", encoding="utf-8") as f:
    for cp in clips:
        f.write(f"file '{os.path.abspath(cp)}'\\n")
final_mp4 = "outputs/ntk_music_video_final.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "outputs/concat.txt", "-i", master_mp3, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", final_mp4], check=True)
assert os.path.exists(final_mp4) and os.path.getsize(final_mp4) > 5000`),
      cellCode(`# 6. Verify Non-Empty Outputs & Download ZIP
import os, shutil
files_out = [os.path.join(dp, fn) for dp, _, fns in os.walk("outputs") for fn in fns if os.path.getsize(os.path.join(dp, fn)) > 0]
if not files_out:
    raise RuntimeError("No output files generated in ./outputs/")
zp = shutil.make_archive("ntk_cloud_gpu_output", "zip", "outputs")
print("Created non-empty ZIP:", zp, os.path.getsize(zp), "bytes")
try:
    from google.colab import files
    files.download(zp)
except Exception:
    print("Download ntk_cloud_gpu_output.zip from Kaggle Output panel (/kaggle/working).")`),
    ],
  };
  return JSON.stringify(nb, null, 2);
}

export async function buildMobileMusicVideoZip(input: MobileMusicInput): Promise<{
  bytes: Uint8Array;
  fileName: string;
  summary: string;
  providerSummary: string;
  copyPasteMasterPrompt: string;
  antigravityPrompt: string;
  codexPrompt: string;
}> {
  const vocalDesc =
    input.vocalMode === 'VOCAL'
      ? 'expressive warm lead vocals with tight harmonies'
      : '100% instrumental, zero lead vocals';

  let audioCorePrompt = `${input.genre}, ${input.mood}, ${input.bpm} BPM, key of ${input.musicalKey}, ${vocalDesc}, warm analog mix, ${input.theme}`;
  let lyrics =
    input.vocalMode === 'INSTRUMENTAL'
      ? '[Intro - Motif]\n\n[Verse 1 - Groove]\n\n[Chorus - Lift]\n\n[Outro]\n[End]'
      : input.customLyrics?.trim()
      ? input.customLyrics.trim()
      : `[Intro - ${input.genre} at ${input.bpm} BPM]\n\n[Verse 1]\n${input.theme}\nEvery focused move builds momentum through the night\n\n[Chorus | Anthemic | Warm Harmonies]\n${input.title}, feel the signal rising clear\nNo retreat when the breakthrough hour is here\n(Breakthrough hour!)\n\n[Outro]\n[End]`;
  let riffusionTags = clampText(`${input.genre}, ${input.mood}, ${input.bpm} bpm, ${input.vocalMode === 'VOCAL' ? 'vocal' : 'instrumental'}`, 120);
  let scenePrompts = [
    `${input.aspectRatio} opening hook scene for "${input.title}" (${input.theme})`,
    `${input.aspectRatio} story progression matching ${input.mood} mood at ${input.bpm} BPM`,
    `${input.aspectRatio} chorus climax shot with dynamic lighting`,
    `${input.aspectRatio} clean closing frame for CTA`,
  ];

  let providerSummary = 'Offline Music & Video Engine';
  const ai = await generateMobileAI(
    `Build an Audio + Music Video prompt JSON for "${input.title}" (${input.genre}, ${input.mood}, ${input.bpm} BPM, ${input.musicalKey}, ${input.vocalMode}). Theme: ${input.theme}.
Return STRICT JSON:
{
  "audioCorePrompt": "...",
  "riffusionTags": "under 110 chars",
  "lyrics": "structured lyrics with [Intro], [Verse 1], [Chorus], [Outro]",
  "scenePrompts": ["scene 1", "scene 2", "scene 3", "scene 4"]
}`,
    true
  );

  if (ai.ok && ai.text) {
    const parsed = extractJsonSafe<{
      audioCorePrompt?: string;
      riffusionTags?: string;
      lyrics?: string;
      scenePrompts?: string[];
    }>(ai.text);
    if (parsed) {
      if (parsed.audioCorePrompt) audioCorePrompt = parsed.audioCorePrompt;
      if (parsed.riffusionTags) riffusionTags = clampText(parsed.riffusionTags, 120);
      if (parsed.lyrics && !input.customLyrics?.trim()) lyrics = parsed.lyrics;
      if (Array.isArray(parsed.scenePrompts) && parsed.scenePrompts.length >= 2) {
        scenePrompts = parsed.scenePrompts.slice(0, 4);
      }
      providerSummary = ai.providerSummary;
    }
  }

  const sunoStyle = clampText(audioCorePrompt, 1000);
  const sunoExclude = cleanSunoExclude(
    input.vocalMode === 'INSTRUMENTAL' ? `vocals, singing, ${input.excludeTraits}` : input.excludeTraits
  );
  const murekaBrief = clampText(audioCorePrompt, 1024);

  const flowBlock = `## Google Flow Music (Lyria 3.5) + Veo Video\nURL: https://labs.google/fx/tools/flow\n\n### Audio Prompt\n${audioCorePrompt}\n\n### Veo Synced Video Prompts (${input.aspectRatio})\n${scenePrompts.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  const sunoBlock = `## Suno (v4.5 / v5 Custom Mode)\nURL: https://suno.com\nStyle (${sunoStyle.length}/1000): ${sunoStyle}\nExclude: ${sunoExclude}\n\nLyrics:\n${clampText(lyrics, 3000)}`;
  const trebloBlock = `## Treblo (formerly Sonauto)\nURL: https://treblo.com\nPrompt: ${audioCorePrompt}\nTags: ${input.genre}, ${input.mood}, ${input.bpm} BPM, ${input.musicalKey}\n\nLyrics:\n${lyrics}`;
  const aceBlock = `## ACE Studio (Real MIDI + Lyrics)\nURL: https://acestudio.ai\nImport "07_ace_studio_melody_guide.mid" (${input.bpm} BPM, ${input.musicalKey}) and paste lyrics:\n${lyrics}`;
  const udioBlock = `## Udio\nURL: https://udio.com (Strength ~45%)\nPrompt: Genre: ${input.genre} | Mood: ${input.mood} | ${input.bpm} BPM | ${input.musicalKey} | ${vocalDesc}`;
  const murekaBlock = `## Mureka (v8–v9.5)\nURL: https://mureka.ai\nBrief (${murekaBrief.length}/1024): ${murekaBrief}\n\nLyrics:\n${clampText(lyrics, 3000)}`;
  const riffusionBlock = `## Riffusion\nURL: https://riffusion.com\nVibe Tags (${riffusionTags.length}/120): ${riffusionTags}\n\nLyrics:\n${lyrics}`;
  const elevenBlock = `## ElevenLabs Music\nURL: https://elevenlabs.io\nStudio Prompt: ${input.genre}, ${input.mood}, ${input.bpm} BPM in ${input.musicalKey}, close-mic'd, tape saturation, wide stereo master.`;

  const copyPasteMasterPrompt = [
    `# ${input.title} — Complete Copy-Paste Audio + Video Prompt`,
    input.platform === 'ALL_PLATFORMS_MASTER'
      ? [flowBlock, sunoBlock, trebloBlock, aceBlock, udioBlock, murekaBlock, riffusionBlock, elevenBlock].join('\n\n---\n\n')
      : input.platform === 'GOOGLE_FLOW'
      ? flowBlock
      : input.platform === 'SUNO'
      ? `${sunoBlock}\n\n---\n\n${flowBlock}`
      : input.platform === 'TREBLO'
      ? `${trebloBlock}\n\n---\n\n${flowBlock}`
      : input.platform === 'ACE_STUDIO'
      ? `${aceBlock}\n\n---\n\n${flowBlock}`
      : input.platform === 'UDIO'
      ? `${udioBlock}\n\n---\n\n${flowBlock}`
      : input.platform === 'MUREKA'
      ? `${murekaBlock}\n\n---\n\n${flowBlock}`
      : input.platform === 'RIFFUSION'
      ? `${riffusionBlock}\n\n---\n\n${flowBlock}`
      : input.platform === 'ELEVENLABS_MUSIC'
      ? `${elevenBlock}\n\n---\n\n${flowBlock}`
      : `${flowBlock}\n\n---\n\nColab/Kaggle Notebook: 06_colab_kaggle_music_video.ipynb (${input.colabEngine})`,
  ].join('\n\n');

  const pInfo = PLATFORM_NAMES[input.platform];
  const antigravityPrompt = `Open BrowserOS neo using profile FEAICCWS. Go to ${pInfo.url} (${pInfo.name}) with Turbo Mode OFF. Paste prompts from 01_COPY_PASTE_COMPLETE_WORKFLOW.md for "${input.title}", audition Track 1, save audio, then run Google Flow Video or 06_colab_kaggle_music_video.ipynb on ${input.cloudHost}.`;
  const codexPrompt = `Follow 01_COPY_PASTE_COMPLETE_WORKFLOW.md and 06_colab_kaggle_music_video.ipynb (${input.colabEngine} with T4 float32 NaN fix) to produce -14 LUFS mastered MP3 and beat-synced ${input.aspectRatio} MP4 video.`;

  const nbJson = buildMobileColabNotebook({
    title: input.title,
    cloudHost: input.cloudHost,
    engine: input.colabEngine,
    audioPrompt: audioCorePrompt,
    lyrics,
    bpm: input.bpm,
    aspectRatio: input.aspectRatio,
    vocalMode: input.vocalMode,
    scenePrompts,
  });
  const midiBytes = buildMobileVocalGuideMidi({
    title: input.title,
    bpm: input.bpm,
    musicalKey: input.musicalKey,
    bars: 8,
  });

  const zip = new JSZip();
  zip.file('00_README_START_HERE.txt', `NTK CREATOR COMMAND — MUSIC + VIDEO PACK\nTitle: ${input.title}\nPlatform: ${pInfo.name}\nTempo: ${input.bpm} BPM (${input.musicalKey})\n`);
  zip.file('01_COPY_PASTE_COMPLETE_WORKFLOW.md', copyPasteMasterPrompt);
  zip.file('02_AGENT_PROMPTS_ANTIGRAVITY_CODEX.md', `# Antigravity Prompt\n${antigravityPrompt}\n\n# Codex Prompt\n${codexPrompt}\n`);
  zip.file('06_colab_kaggle_music_video.ipynb', nbJson);
  zip.file('07_ace_studio_melody_guide.mid', midiBytes);

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return {
    bytes,
    fileName: `ntk-command-${slugifyName(input.title, 'music')}.zip`,
    summary: `${pInfo.name} Audio + Video ZIP (includes .ipynb + .mid)`,
    providerSummary,
    copyPasteMasterPrompt,
    antigravityPrompt,
    codexPrompt,
  };
}
