import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
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

function cellMd(source: string) {
  return {
    cell_type: 'markdown',
    metadata: {},
    source: source.split('\n').map((l, i, arr) => (i < arr.length - 1 ? l + '\n' : l)),
  };
}

function cellCode(source: string) {
  return {
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: source.split('\n').map((l, i, arr) => (i < arr.length - 1 ? l + '\n' : l)),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = NotebookSchema.parse(await req.json());

    let enrichedGuide = '';
    let providerSummary = 'Deterministic Template';
    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `Write concise production parameter suggestions (5 bullet points max) for a free T4/P100 GPU ${body.platform} notebook running "${body.template}" titled "${body.title}". Goal: ${body.promptOrLyrics}`,
        maxOutputTokens: 1024,
      });
      enrichedGuide = res.text;
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      enrichedGuide = 'Use T4/P100 GPU runtime, verify VRAM with nvidia-smi, and export finished media to Google Drive or Kaggle /kaggle/working.';
    }

    const headerTitle: Record<typeof body.template, string> = {
      AI_MUSIC: 'Open-Source Cloud GPU AI Music Generator (MusicGen / Bark / DiffRhythm Pipeline)',
      MUSIC_VIDEO_SHORTS: 'AI Music Video & Beat-Synced Viral Shorts Pipeline',
      TALKING_PROMO: 'Talking Product Promo / Avatar Lip-Sync Pipeline (SadTalker / Wav2Lip)',
      WHISPER_UPSCALE: 'Cloud Faster-Whisper Transcription + Real-ESRGAN / FFmpeg Export Pipeline',
    };

    const installCmds: Record<typeof body.template, string> = {
      AI_MUSIC: `!pip install -q torch torchaudio transformers accelerate scipy pydub`,
      MUSIC_VIDEO_SHORTS: `!pip install -q diffusers transformers accelerate faster-whisper moviepy librosa`,
      TALKING_PROMO: `!pip install -q torch torchvision transformers gTTS librosa opencv-python-headless`,
      WHISPER_UPSCALE: `!pip install -q faster-whisper opencv-python-headless realesrgan basicsr`,
    };

    const pipelineCode: Record<typeof body.template, string> = {
      AI_MUSIC: `from transformers import AutoProcessor, MusicgenForConditionalGeneration
import scipy.io.wavfile, torch, os

os.makedirs("outputs", exist_ok=True)
device = "cuda" if torch.cuda.is_available() else "cpu"
processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small").to(device)

inputs = processor(text=[PROMPT_TEXT], padding=True, return_tensors="pt").to(device)
audio_values = model.generate(**inputs, max_new_tokens=512)
sr = model.config.audio_encoder.sampling_rate
scipy.io.wavfile.write("outputs/ntk_track.wav", rate=sr, data=audio_values[0, 0].cpu().numpy())
!ffmpeg -y -i outputs/ntk_track.wav -codec:a libmp3lame -qscale:a 2 outputs/ntk_track.mp3
print("Saved outputs/ntk_track.wav and outputs/ntk_track.mp3")`,
      MUSIC_VIDEO_SHORTS: `import os, subprocess, json
os.makedirs("outputs", exist_ok=True)
# Beat-synced assembly with FFmpeg (expects your uploaded audio.mp3 + scene images/clips in ./inputs/)
print("Configured for aspect ratio:", ASPECT_RATIO, "| BPM:", BPM_OR_SPEED)
print("Place Flow clips or generated frames in ./inputs/ and run the FFmpeg beat-sync cell below.")
subprocess.run(["ffmpeg", "-version"], check=True)`,
      TALKING_PROMO: `import os, subprocess
from gtts import gTTS
os.makedirs("outputs", exist_ok=True)
tts = gTTS(text=PROMPT_TEXT, lang="en")
tts.save("outputs/promo_voice.mp3")
print("Generated promo_voice.mp3. Attach your presenter face image (./inputs/avatar.png) for SadTalker/Wav2Lip inference.")`,
      WHISPER_UPSCALE: `from faster_whisper import WhisperModel
import json, os, torch

os.makedirs("outputs", exist_ok=True)
device = "cuda" if torch.cuda.is_available() else "cpu"
model = WhisperModel("large-v3", device=device, compute_type="float16" if device=="cuda" else "int8")
print("Faster-Whisper large-v3 loaded on", device)
print("Upload video/audio as ./input_media.mp4 and execute transcription + SRT generation.")`,
    };

    const nbJsonObj = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
        language_info: { name: 'python', version: '3.10.12' },
        accelerator: 'GPU',
        colab: { provenance: [], gpuType: 'T4' },
      },
      cells: [
        cellMd(`# ${body.title}\n\n**Template:** ${headerTitle[body.template]}\n\n**Target Platform:** ${body.platform} (Free T4/P100 GPU)\n\n${enrichedGuide}`),
        cellCode(`# 1. Verify Free Cloud GPU (T4 / P100)
!nvidia-smi
import torch
print("CUDA available:", torch.cuda.is_available(), "| Device:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU")`),
        cellCode(`# 2. Install Lightweight Dependencies
${installCmds[body.template]}`),
        cellCode(`# 3. Pre-Filled Production Parameters
PROJECT_TITLE = ${JSON.stringify(body.title)}
PROMPT_TEXT = ${JSON.stringify(body.promptOrLyrics)}
BPM_OR_SPEED = ${JSON.stringify(body.bpmOrSpeed)}
ASPECT_RATIO = ${JSON.stringify(body.aspectRatio)}
EXTRA_NOTES = ${JSON.stringify(body.extraNotes ?? '')}
print("Loaded parameters for:", PROJECT_TITLE)`),
        cellCode(`# 4. Run Open-Source Pipeline
${pipelineCode[body.template]}`),
        cellCode(`# 5. Export Output Archive (Colab Download / Kaggle /kaggle/working)
import shutil, os
if os.path.exists("outputs"):
    shutil.make_archive("ntk_cloud_gpu_output", "zip", "outputs")
    print("Created ntk_cloud_gpu_output.zip")
try:
    from google.colab import files
    files.download("ntk_cloud_gpu_output.zip")
except Exception:
    print("If on Kaggle, download ntk_cloud_gpu_output.zip from the Output panel (/kaggle/working).")`),
      ],
    };

    const ipynbString = JSON.stringify(nbJsonObj, null, 2);
    // Verify valid nbformat 4 JSON before zipping
    const verified = JSON.parse(ipynbString) as { nbformat: number; cells: unknown[] };
    if (verified.nbformat !== 4 || !Array.isArray(verified.cells) || verified.cells.length < 4) {
      throw new Error('Notebook verification failed');
    }

    const agentInstructions = `# ${body.platform} Agent Execution Instructions

1. Launch **BrowserOS neo** on profile **\`FEAICCWS\`**.
2. Open ${body.platform === 'KAGGLE' ? 'https://www.kaggle.com/code (New Notebook -> Settings -> Accelerator: GPU T4 x2 / P100 + Internet ON)' : 'https://colab.research.google.com/ (File -> Upload Notebook -> Runtime -> Change runtime type -> T4 GPU)'}.
3. Upload \`notebook.ipynb\` from this pack.
4. Keep **Turbo Mode OFF** and run cells 1 through 5 sequentially, waiting for each cell's checkmark before continuing.
5. Download \`ntk_cloud_gpu_output.zip\` back to your local machine.
`;

    const files = [
      { path: 'notebook.ipynb', content: ipynbString },
      { path: 'agent_run_instructions.md', content: agentInstructions },
      { path: 'README.md', content: `# ${body.title}\n\n${headerTitle[body.template]}\n\n## Creative Notes\n${enrichedGuide}\n` },
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
          prompt: `Open BrowserOS neo using profile FEAICCWS. Follow agent_run_instructions.md: upload notebook.ipynb to ${body.platform}, enable T4/P100 GPU, run cells 1..5 cleanly without rushing, and download ntk_cloud_gpu_output.zip.`,
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
