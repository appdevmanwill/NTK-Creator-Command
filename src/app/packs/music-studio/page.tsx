'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Disc3, Music, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer, TriggerPromptOption } from '@/components/PackResultViewer';
import { AdvancedOptionsToggle, StudioStarterBanner } from '@/components/GuidedHelpers';
import { useToast } from '@/components/ToastProvider';

type PlatformId =
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

type ProjectMode = 'SINGLE_AUDIO_AND_VIDEO' | 'ALBUM_STREAM_PACK' | 'SCORE_FLOW_MOVIE';

const PLATFORM_META: Record<PlatformId, { label: string; hint: string }> = {
  GOOGLE_FLOW: {
    label: 'Google Flow Music (Lyria 3.5 + Veo Video)',
    hint: 'Layered audio prompt + Gemini AI Producer follow-up prompts + synced Veo music-video storyboard',
  },
  SUNO: {
    label: 'Suno (v4.5 / v5 / v5.5+ Custom Mode)',
    hint: 'Enforces <=1,000 char front-loaded Style Box, lowercase comma Exclude list, and [Meta-Tag] lyrics',
  },
  TREBLO: {
    label: 'Treblo (formerly Sonauto)',
    hint: 'Simple/Advanced prompt + Treblo tag library + section-swap & extension prompts',
  },
  ACE_STUDIO: {
    label: 'ACE Studio (AI Singing Voice + Real MIDI)',
    hint: 'Includes downloadable binary .mid melody guide + syllable-aligned lyrics + vibrato/timbre tuning',
  },
  UDIO: {
    label: 'Udio (5-Block + / Guidance)',
    hint: '5-block compositional prompt + [Section] structure + 45% prompt strength',
  },
  MUREKA: {
    label: 'Mureka (v8 – v9.5)',
    hint: 'Production brief (<=1,024 chars) + bracketed lyrics (<=3,000 chars)',
  },
  RIFFUSION: {
    label: 'Riffusion',
    hint: 'Strictly enforced <=120-char textural Vibe/Style tags + [Section] lyrics',
  },
  ELEVENLABS_MUSIC: {
    label: 'ElevenLabs Music (v2 / v2.5)',
    hint: 'Studio mixing descriptors, exact BPM, zero artist names, and timed section plan',
  },
  COLAB_KAGGLE_OPEN: {
    label: 'Free Cloud GPU (Colab / Kaggle)',
    hint: 'Working ACE-Step 1.5 (with T4 float32 NaN fix) / DiffRhythm / MusicGen-Medium -> Audio + MP4 Video',
  },
  ALL_PLATFORMS_MASTER: {
    label: 'All Platforms Master Pack (Every Generator)',
    hint: 'Generates tailored copy-paste boxes for ALL 8 generators + Colab/Kaggle .ipynb + ACE Studio .mid',
  },
};

export default function MusicVideoStudioPage() {
  const { pushToast } = useToast();
  const [platform, setPlatform] = useState<PlatformId>('GOOGLE_FLOW');
  const [mode, setMode] = useState<ProjectMode>('SINGLE_AUDIO_AND_VIDEO');
  const [cloudHost, setCloudHost] = useState<'COLAB' | 'KAGGLE'>('COLAB');
  const [colabEngine, setColabEngine] = useState<'ACE_STEP_1_5' | 'DIFFRHYTHM' | 'MUSICGEN_MEDIUM'>('ACE_STEP_1_5');

  const [title, setTitle] = useState('Lagos Rain Reflections');
  const [theme, setTheme] = useState('A late-night reflection on ambition, resilience, and turning quiet focus into breakthroughs');
  const [genre, setGenre] = useState('Afro-Synth & Cinematic Lo-Fi');
  const [mood, setMood] = useState('Soulful, Reflective & Driving');
  const [bpm, setBpm] = useState(108);
  const [musicalKey, setMusicalKey] = useState('C minor');
  const [vocalMode, setVocalMode] = useState<'VOCAL' | 'INSTRUMENTAL'>('VOCAL');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('9:16');
  const [visualStyle, setVisualStyle] = useState('35mm neo-noir rain reflections, warm champagne gold & obsidian palette');
  const [excludeTraits, setExcludeTraits] = useState('harsh clipping, muddy sub-bass, abrupt fade');
  const [customLyrics, setCustomLyrics] = useState('');
  const [trackCount, setTrackCount] = useState(8);

  const [movieList, setMovieList] = useState<Array<{ id: string; title: string }>>([]);
  const [attachedMovieProjectId, setAttachedMovieProjectId] = useState('');

  const [metronomeOn, setMetronomeOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    files: PackFilePreview[];
    triggerPrompts: TriggerPromptOption[];
    copyPasteMasterPrompt: string;
    providerSummary: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/projects?type=FLOW_MOVIE')
      .then((r) => r.json())
      .then((d) => setMovieList(d.projects ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!metronomeOn) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    const ctx = audioCtxRef.current;

    const click = () => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 920;
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.065);
    };
    click();
    const ms = Math.max(250, Math.round(60000 / Math.max(50, Math.min(220, bpm))));
    timerRef.current = window.setInterval(click, ms);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [metronomeOn, bpm]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/packs/music-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          mode,
          cloudHost,
          colabEngine,
          title,
          theme,
          genre,
          mood,
          bpm,
          musicalKey,
          vocalMode,
          aspectRatio,
          visualStyle,
          excludeTraits,
          customLyrics: customLyrics.trim() || undefined,
          trackCount,
          attachedMovieProjectId: attachedMovieProjectId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build Music & Video pack');
      setResult(data);
      pushToast({ title: 'Music + Video Production Pack Ready', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Build failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Music & Video Command Studio"
        subtitle="Build ready-to-paste audio + video workflows for Google Flow Music (Lyria 3.5 + Veo), Suno, Treblo, ACE Studio (with real MIDI), Udio, Mureka, Riffusion, ElevenLabs, and working Colab/Kaggle GPU notebooks."
        badge="Audio + Video · All Platforms"
      />

      <StudioStarterBanner
        whatYouGet="A complete .ZIP pack containing platform-exact Copy-Paste Prompts, Antigravity/Codex agent playbooks, a working Colab/Kaggle .ipynb (Audio + Beat-Synced MP4 Video), a real ACE Studio .mid file, and local -14 LUFS FFmpeg scripts."
        safeNote="Works 100% offline · Real MIDI + Verified Notebooks"
        samples={[
          {
            label: 'Google Flow Music + Veo Video',
            onApply: () => {
              setPlatform('GOOGLE_FLOW');
              setMode('SINGLE_AUDIO_AND_VIDEO');
              setTitle('Midnight Watchmaker Anthem');
              setGenre('Cinematic Afro-Synth');
              setBpm(108);
              setVocalMode('VOCAL');
              setAspectRatio('16:9');
              pushToast({ title: 'Loaded Google Flow Music + Veo preset', tone: 'info' });
            },
          },
          {
            label: 'Suno v5 Song + 9:16 Short',
            onApply: () => {
              setPlatform('SUNO');
              setMode('SINGLE_AUDIO_AND_VIDEO');
              setTitle('Streetlights & Blueprints');
              setGenre('Melodic Hip-Hop & Soul');
              setBpm(94);
              setVocalMode('VOCAL');
              setAspectRatio('9:16');
              pushToast({ title: 'Loaded Suno v5 Custom Mode preset', tone: 'info' });
            },
          },
          {
            label: 'All Platforms + Colab ACE-Step 1.5',
            onApply: () => {
              setPlatform('ALL_PLATFORMS_MASTER');
              setColabEngine('ACE_STEP_1_5');
              setTitle('Voice of the People');
              setGenre('Storytelling Rap / Afrobeats');
              setBpm(102);
              setVocalMode('VOCAL');
              pushToast({ title: 'Loaded All-Platforms + Colab ACE-Step 1.5 preset', tone: 'info' });
            },
          },
          {
            label: 'ACE Studio Vocal + MIDI',
            onApply: () => {
              setPlatform('ACE_STUDIO');
              setTitle('Golden Hour Ballad');
              setGenre('Acoustic Soul & Piano');
              setBpm(84);
              setMusicalKey('G major');
              setVocalMode('VOCAL');
              pushToast({ title: 'Loaded ACE Studio + MIDI preset', tone: 'info' });
            },
          },
        ]}
      />

      <Card>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Target Music &amp; Video Platform</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
                {(Object.keys(PLATFORM_META) as PlatformId[]).map((pid) => (
                  <option key={pid} value={pid}>
                    {PLATFORM_META[pid].label}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[11px] text-[var(--accent-text)]">{PLATFORM_META[platform].hint}</p>
            </div>
            <div>
              <Label>Production Mode</Label>
              <Select value={mode} onChange={(e) => setMode(e.target.value as ProjectMode)}>
                <option value="SINGLE_AUDIO_AND_VIDEO">Single Song / Track + Beat-Synced Music Video</option>
                <option value="ALBUM_STREAM_PACK">Cohesive Album / 1-Hour Stream Pack (4–12 Tracks)</option>
                <option value="SCORE_FLOW_MOVIE">Score an Existing Flow Movie Pack</option>
              </Select>
            </div>
          </div>

          {mode === 'SCORE_FLOW_MOVIE' && (
            <div>
              <Label>Select Saved Flow Movie Pack to Score</Label>
              <Select value={attachedMovieProjectId} onChange={(e) => setAttachedMovieProjectId(e.target.value)}>
                <option value="">-- Optional: Pick a Flow Movie from Vault --</option>
                {movieList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {mode === 'ALBUM_STREAM_PACK' && (
            <div className="max-w-xs">
              <Label>Number of Tracks (4–12)</Label>
              <Input
                type="number"
                min={4}
                max={12}
                value={trackCount}
                onChange={(e) => setTrackCount(Math.min(12, Math.max(4, Number(e.target.value) || 8)))}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Song / Project Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Genre &amp; Instrumentation</Label>
              <Input value={genre} onChange={(e) => setGenre(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>Story, Lyrics Theme or Emotional Focus</Label>
            <Textarea rows={2} value={theme} onChange={(e) => setTheme(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>BPM (Tempo)</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  min={50}
                  max={220}
                  value={bpm}
                  onChange={(e) => setBpm(Math.min(220, Math.max(50, Number(e.target.value) || 108)))}
                />
                <Button
                  type="button"
                  variant={metronomeOn ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setMetronomeOn(!metronomeOn)}
                  title="Audition BPM click offline"
                >
                  {metronomeOn ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>Musical Key</Label>
              <Select value={musicalKey} onChange={(e) => setMusicalKey(e.target.value)}>
                {[
                  'C minor',
                  'A minor',
                  'D minor',
                  'E minor',
                  'G minor',
                  'C major',
                  'G major',
                  'F major',
                  'D major',
                  'A major',
                  'Eb major',
                  'Bb major',
                ].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Vocals</Label>
              <Select value={vocalMode} onChange={(e) => setVocalMode(e.target.value as 'VOCAL' | 'INSTRUMENTAL')}>
                <option value="VOCAL">With Lead Vocals</option>
                <option value="INSTRUMENTAL">Instrumental Only</option>
              </Select>
            </div>
            <div>
              <Label>Video Aspect</Label>
              <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}>
                <option value="9:16">9:16 Shorts / Reels</option>
                <option value="16:9">16:9 YouTube Widescreen</option>
              </Select>
            </div>
          </div>

          <AdvancedOptionsToggle>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Mood &amp; Energy</Label>
                  <Input value={mood} onChange={(e) => setMood(e.target.value)} />
                </div>
                <div>
                  <Label>Cloud GPU Host (.ipynb)</Label>
                  <Select value={cloudHost} onChange={(e) => setCloudHost(e.target.value as 'COLAB' | 'KAGGLE')}>
                    <option value="COLAB">Google Colab (Free T4 GPU)</option>
                    <option value="KAGGLE">Kaggle Notebooks (T4 x2 / P100)</option>
                  </Select>
                </div>
                <div>
                  <Label>Colab / Kaggle Audio Model</Label>
                  <Select
                    value={colabEngine}
                    onChange={(e) => setColabEngine(e.target.value as 'ACE_STEP_1_5' | 'DIFFRHYTHM' | 'MUSICGEN_MEDIUM')}
                  >
                    <option value="ACE_STEP_1_5">ACE-Step 1.5 (Vocals + T4 FP32 Fix)</option>
                    <option value="DIFFRHYTHM">DiffRhythm (Apache 2.0 Fast Full Song)</option>
                    <option value="MUSICGEN_MEDIUM">MusicGen-Medium (Clean Instrumental)</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Music Video Visual Style</Label>
                  <Input value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} />
                </div>
                <div>
                  <Label>Exclude / Avoid Styles</Label>
                  <Input value={excludeTraits} onChange={(e) => setExcludeTraits(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Custom Lyrics (Optional — Auto-Written If Left Blank)</Label>
                <Textarea
                  rows={4}
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder="[Verse 1]&#10;Paste your own lyrics here or leave blank to generate structured [Intro]/[Verse]/[Chorus] lyrics..."
                />
              </div>
            </div>
          </AdvancedOptionsToggle>

          <Button type="submit" disabled={loading} data-testid="build-music-studio-btn">
            <Music className="h-4 w-4" />
            {loading ? 'Building Audio + Video Pack...' : 'Generate Complete Music + Video Pack (.ZIP + .ipynb + .mid)'}
          </Button>
        </form>
      </Card>

      {result && (
        <div className="space-y-5" data-testid="music-studio-result">
          <Card className="space-y-3 border-[var(--border-accent)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Disc3 className="h-4 w-4 text-[var(--accent-text)]" />
                <h3 className="text-sm font-bold">1-Click Complete Copy-Paste Workflow Prompt</h3>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.copyPasteMasterPrompt);
                  setCopiedMaster(true);
                  pushToast({ title: 'Copied complete copy-paste prompt', tone: 'success' });
                  setTimeout(() => setCopiedMaster(false), 2000);
                }}
              >
                {copiedMaster ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Complete Prompt
              </Button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border bg-[var(--bg-elevated)] p-3.5 text-xs font-mono whitespace-pre-wrap">
              {result.copyPasteMasterPrompt}
            </pre>
          </Card>

          <PackResultViewer
            projectId={result.projectId}
            title={`${title} — Music & Video Pack`}
            files={result.files}
            triggerPrompts={result.triggerPrompts}
            providerSummary={result.providerSummary}
          />
        </div>
      )}
    </div>
  );
}
