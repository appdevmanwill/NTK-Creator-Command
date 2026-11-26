'use client';

import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Eye, Layers, Sparkles } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer } from '@/components/PackResultViewer';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

interface SavedStyle {
  id: string;
  name: string;
  sourceReference: string;
  styleHeader: string;
  paletteJson: string;
}

export default function FlowBulkPage() {
  const { pushToast } = useToast();
  const [youtubeUrl, setYoutubeUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [styleHeader, setStyleHeader] = useState('Flat high-contrast 2D vector explainer illustration, deep midnight slate background, glowing indigo and amber highlights, bold clean silhouettes');
  const [palette, setPalette] = useState<string[]>(['#0F172A', '#4F46E5', '#F59E0B', '#F8FAFC']);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [styleName, setStyleName] = useState('');

  const [title, setTitle] = useState('Why Silent Creators Outsell Loud Channels');
  const [topic, setTopic] = useState('How micro digital products turn 5,000 views into steady daily sales');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [targetMinutes, setTargetMinutes] = useState(2);
  const [vibeCloseness, setVibeCloseness] = useState<'EXACT' | 'BALANCED' | 'CREATIVE'>('BALANCED');
  const [recurringCharacter, setRecurringCharacter] = useState('Minimalist indigo hoodie stickman figure with glowing visor');

  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    sceneCount: number;
    flowBulkBlock: string;
    narrationScript: string;
    files: PackFilePreview[];
    providerSummary: string;
  } | null>(null);

  const loadStyles = async () => {
    try {
      const r = await fetch('/api/packs/flow-bulk/styles');
      const d = await r.json();
      setSavedStyles(d.styles ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStyles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeStyle = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/packs/flow-bulk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: imageBase64 ? undefined : youtubeUrl,
          imageBase64: imageBase64 || undefined,
          imageMimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setStyleHeader(data.styleHeader);
      if (Array.isArray(data.palette)) setPalette(data.palette);
      pushToast({ title: 'Visual style extracted', description: data.provider || 'Fallback preset', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Style extraction failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveStyle = async () => {
    if (!styleName.trim() || !styleHeader.trim()) return;
    await fetch('/api/packs/flow-bulk/styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: styleName.trim(),
        sourceReference: youtubeUrl || 'Uploaded screenshot',
        styleHeader,
        palette,
      }),
    });
    setStyleName('');
    pushToast({ title: 'Visual style saved for future series', tone: 'success' });
    await loadStyles();
  };

  const handleGenerateBulk = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/packs/flow-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          topic,
          aspectRatio,
          targetMinutes,
          vibeCloseness,
          recurringCharacter,
          styleHeader,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk generation failed');
      setResult(data);
      pushToast({ title: 'Bulk Flow Style Pack ready', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Flow Bulk Image & Style Cloner"
        subtitle="Extract visual style from any YouTube thumbnail or screenshot, lock one Nano Banana global style header, and generate two-digit ordered scenes (01..NN) + timed narration."
        badge="~7.5 scenes/min"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold">1. Extract or Load Visual Style</h2>
          </div>

          {savedStyles.length > 0 && (
            <div>
              <Label>Load Saved Series Style</Label>
              <Select
                onChange={(e) => {
                  const found = savedStyles.find((s) => s.id === e.target.value);
                  if (found) setStyleHeader(found.styleHeader);
                }}
              >
                <option value="">Choose saved style...</option>
                {savedStyles.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label>YouTube Video URL (Server fetches thumbnail cleanly)</Label>
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </div>

          <div>
            <Label>Or Upload Reference Screenshot</Label>
            <Input type="file" accept="image/*" onChange={handleFileChange} />
          </div>

          <Button variant="secondary" onClick={handleAnalyzeStyle} disabled={analyzing} className="w-full">
            <Sparkles className="h-4 w-4" />
            {analyzing ? 'Analyzing with Vision Router...' : 'Extract Style Palette & Header'}
          </Button>

          {palette.length > 0 && (
            <div className="flex items-center gap-2">
              {palette.map((hex) => (
                <div key={hex} className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: hex }} />
                  {hex}
                </div>
              ))}
            </div>
          )}

          <div>
            <Label>Global Nano Banana Style Header</Label>
            <Textarea rows={3} value={styleHeader} onChange={(e) => setStyleHeader(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Input value={styleName} onChange={(e) => setStyleName(e.target.value)} placeholder="Save style name..." />
            <Button variant="secondary" onClick={handleSaveStyle} type="button">
              <BookmarkPlus className="h-4 w-4" /> Save
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold">2. Bulk Ordered Scenes & Narration</h2>
          </div>

          <IdeaSparkWidget
            category="FLOW_BULK"
            heading="Need a video topic & character idea?"
            onApplyIdea={(fields) => {
              if (fields.title) setTitle(fields.title);
              if (fields.topic) setTopic(fields.topic);
              if (fields.recurringCharacter) setRecurringCharacter(fields.recurringCharacter);
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}>
                <option value="16:9">16:9 Widescreen</option>
                <option value="9:16">9:16 Vertical</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>1-Line Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Target Length: {targetMinutes} min (~{Math.round(targetMinutes * 7.5)} scenes)</Label>
              <input
                type="range"
                min={1}
                max={10}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <Label>Vibe Closeness</Label>
              <Select value={vibeCloseness} onChange={(e) => setVibeCloseness(e.target.value as typeof vibeCloseness)}>
                <option value="EXACT">Exact Clone</option>
                <option value="BALANCED">Balanced Adaptation</option>
                <option value="CREATIVE">Creative Evolution</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Recurring Character (Optional)</Label>
            <Input value={recurringCharacter} onChange={(e) => setRecurringCharacter(e.target.value)} />
          </div>

          <Button onClick={handleGenerateBulk} disabled={generating} className="w-full">
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating Bulk Block & Script...' : 'Generate Copy-Paste Flow Block & .ZIP'}
          </Button>
        </Card>
      </div>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={`${title} (${result.sceneCount} Ordered Scenes)`}
          files={result.files}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
