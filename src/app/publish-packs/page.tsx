'use client';

import React, { useState } from 'react';
import { ShieldAlert, UploadCloud } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { PackFilePreview, PackResultViewer } from '@/components/PackResultViewer';
import { AdvancedOptionsToggle, StudioStarterBanner } from '@/components/GuidedHelpers';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

export default function PublishPacksPage() {
  const { pushToast } = useToast();
  const [mode, setMode] = useState<'BROWSER_DRAFT' | 'YOUTUBE_OAUTH'>('BROWSER_DRAFT');
  const [platforms, setPlatforms] = useState<string[]>(['YouTube', 'TikTok']);
  const [localVideoPath, setLocalVideoPath] = useState('C:\\Videos\\final_release.mp4');
  const [localThumbnailPath, setLocalThumbnailPath] = useState('C:\\Videos\\thumbnail.png');
  const [titleOrTopic, setTitleOrTopic] = useState('How to Automate Your Monthly Budget in 15 Minutes');
  const [storeLink, setStoreLink] = useState('https://payhip.com/ntkhub/budget-os');
  const [scheduleIso, setScheduleIso] = useState('2026-12-01T15:00:00Z');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    files: PackFilePreview[];
    providerSummary: string;
  } | null>(null);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/packs/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          platforms: platforms.length ? platforms : ['YouTube'],
          localVideoPath,
          localThumbnailPath,
          titleOrTopic,
          storeLink,
          scheduleIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build publish pack');
      setResult(data);
      pushToast({ title: 'Publishing Pack compiled (.ZIP)', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Build failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safe Draft & Publishing Pack"
        subtitle="Generate your SEO title, description with your product link at the top, tags, and safe upload instructions."
      />

      <StudioStarterBanner
        whatYouGet="A copy-paste SEO metadata sheet + step-by-step upload instructions for BrowserOS neo (or an optional Python YouTube uploader)."
        safeNote="Safe Draft Mode — never posts without your final click"
      />

      <Card className="space-y-4">
        <IdeaSparkWidget
          category="PUBLISH_TOPIC"
          heading="Need a click-worthy video title to publish?"
          onApplyIdea={(fields) => {
            if (fields.titleOrTopic) setTitleOrTopic(fields.titleOrTopic);
          }}
        />
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === 'BROWSER_DRAFT' ? 'primary' : 'secondary'}
              onClick={() => setMode('BROWSER_DRAFT')}
              data-testid="mode-browser-draft"
            >
              <ShieldAlert className="h-4 w-4" /> Mode A: Safe Browser Draft Pack (Default)
            </Button>
            <Button
              type="button"
              variant={mode === 'YOUTUBE_OAUTH' ? 'primary' : 'secondary'}
              onClick={() => setMode('YOUTUBE_OAUTH')}
              data-testid="mode-youtube-oauth"
            >
              <UploadCloud className="h-4 w-4" /> Mode B: Official YouTube API / OAuth Pack
            </Button>
          </div>

          {mode === 'BROWSER_DRAFT' && (
            <div className="flex flex-wrap gap-3">
              {['YouTube', 'TikTok', 'Instagram', 'Facebook'].map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
                  {p}
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Video Title / Topic</Label>
              <Input value={titleOrTopic} onChange={(e) => setTitleOrTopic(e.target.value)} required />
            </div>
            <div>
              <Label>Your Product Store Link (Placed Near Top)</Label>
              <Input value={storeLink} onChange={(e) => setStoreLink(e.target.value)} required />
            </div>
          </div>

          <AdvancedOptionsToggle title="Customize File Paths & Publish Schedule (Optional)">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Local Video File Path</Label>
                <Input value={localVideoPath} onChange={(e) => setLocalVideoPath(e.target.value)} />
              </div>
              <div>
                <Label>Local Thumbnail File Path</Label>
                <Input value={localThumbnailPath} onChange={(e) => setLocalThumbnailPath(e.target.value)} />
              </div>
              <div>
                <Label>Target Schedule (ISO Timestamp)</Label>
                <Input value={scheduleIso} onChange={(e) => setScheduleIso(e.target.value)} />
              </div>
            </div>
          </AdvancedOptionsToggle>

          <Button type="submit" disabled={loading} data-testid="generate-publish-btn">
            <UploadCloud className="h-4 w-4" />
            {loading ? 'Generating Pack...' : `Build ${mode === 'BROWSER_DRAFT' ? 'Safe Draft' : 'Mode B OAuth'} .ZIP`}
          </Button>
        </form>
      </Card>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={`${titleOrTopic} (${mode})`}
          files={result.files}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
