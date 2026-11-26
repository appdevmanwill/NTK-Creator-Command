'use client';

import React, { useState } from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer, TriggerPromptOption } from '@/components/PackResultViewer';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

export default function NotebooksPage() {
  const { pushToast } = useToast();
  const [template, setTemplate] = useState<'AI_MUSIC' | 'MUSIC_VIDEO_SHORTS' | 'TALKING_PROMO' | 'WHISPER_UPSCALE'>('AI_MUSIC');
  const [platform, setPlatform] = useState<'COLAB' | 'KAGGLE'>('COLAB');
  const [title, setTitle] = useState('Midnight Afro-Synth Lo-Fi Instrumental');
  const [promptOrLyrics, setPromptOrLyrics] = useState('Warm analog Rhodes chords, deep Afrobeats percussion groove, vinyl warmth, 108 BPM, crisp stereo master');
  const [bpmOrSpeed, setBpmOrSpeed] = useState('108');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('9:16');
  const [extraNotes, setExtraNotes] = useState('Export WAV + MP3 ready for YouTube background music');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    files: PackFilePreview[];
    triggerPrompts: TriggerPromptOption[];
    providerSummary: string;
  } | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/packs/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          platform,
          title,
          promptOrLyrics,
          bpmOrSpeed,
          aspectRatio,
          extraNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Notebook build failed');
      setResult(data);
      pushToast({ title: 'Verified nbformat 4 .ipynb pack created', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Build failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud GPU Production Lab"
        subtitle="Dispatch heavy AI music scoring, beat-synced shorts, avatar promos, and Whisper/4K mastering onto free Kaggle and Colab T4/P100 cloud GPUs."
        badge="nbformat 4 · $0 GPU"
      />

      <Card className="space-y-4">
        <IdeaSparkWidget
          category="NOTEBOOK_GPU"
          heading="Not sure what audio or video prompt to run on Cloud GPU?"
          onApplyIdea={(fields) => {
            if (fields.title) setTitle(fields.title);
            if (fields.promptOrLyrics) setPromptOrLyrics(fields.promptOrLyrics);
          }}
        />
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Notebook Pipeline</Label>
              <Select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}>
                <option value="AI_MUSIC">AI Music Generation (MusicGen)</option>
                <option value="MUSIC_VIDEO_SHORTS">AI Music Video & Viral Shorts</option>
                <option value="TALKING_PROMO">Talking Product Promo / Avatar</option>
                <option value="WHISPER_UPSCALE">Cloud Whisper + 4K Upscaling/FFmpeg</option>
              </Select>
            </div>
            <div>
              <Label>Target Cloud GPU Host</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as 'COLAB' | 'KAGGLE')}>
                <option value="COLAB">Google Colab (Free T4 GPU)</option>
                <option value="KAGGLE">Kaggle Notebooks (T4 x2 / P100)</option>
              </Select>
            </div>
            <div>
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}>
                <option value="9:16">9:16 Vertical Shorts</option>
                <option value="16:9">16:9 Widescreen</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Notebook Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>BPM / Target Pace</Label>
              <Input value={bpmOrSpeed} onChange={(e) => setBpmOrSpeed(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Prompt / Lyrics / Script</Label>
            <Textarea rows={3} value={promptOrLyrics} onChange={(e) => setPromptOrLyrics(e.target.value)} required />
          </div>

          <div>
            <Label>Extra Export Notes</Label>
            <Input value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} />
          </div>

          <Button type="submit" disabled={loading}>
            <Cpu className="h-4 w-4" />
            {loading ? 'Compiling .ipynb Pack...' : 'Generate Verified .ipynb & Agent Instructions .ZIP'}
          </Button>
        </form>
      </Card>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={`${title} (${platform})`}
          files={result.files}
          triggerPrompts={result.triggerPrompts}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
