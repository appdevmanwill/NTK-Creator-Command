'use client';

import React, { useEffect, useState } from 'react';
import { Film, Sparkles, Wand2 } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer, PausedQuotaState, TriggerPromptOption } from '@/components/PackResultViewer';
import { AdvancedOptionsToggle, NextStepCard, StudioStarterBanner } from '@/components/GuidedHelpers';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

interface OutlineData {
  title: string;
  logline: string;
  characters: Array<{ name: string; role?: string; visualIdentity: string; voiceNote?: string }>;
  locations: Array<{ name: string; visualProfile: string }>;
  scenes: Array<{ sceneNumber: number; title: string; locationName: string; summary: string; shotCount: number }>;
}

interface PriorSeriesProject {
  id: string;
  title: string;
}

export default function FlowMoviePage() {
  const { pushToast } = useToast();
  const [format, setFormat] = useState<'ONE_OFF' | 'NEW_SERIES' | 'CONTINUE_SERIES'>('ONE_OFF');
  const [seriesList, setSeriesList] = useState<PriorSeriesProject[]>([]);
  const [seriesProjectId, setSeriesProjectId] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [runtimeMinutes, setRuntimeMinutes] = useState(3);
  const [outlineMode, setOutlineMode] = useState<'ONE_LINE' | 'MANUAL'>('ONE_LINE');
  const [idea, setIdea] = useState("In 1924 Lagos, an apprentice watchmaker discovers an encrypted cipher hidden inside the governor's pocket watch.");
  const [manualTitle, setManualTitle] = useState('');
  const [manualCharacters, setManualCharacters] = useState('');
  const [manualLocations, setManualLocations] = useState('');
  const [manualPlot, setManualPlot] = useState('');

  const [outline, setOutline] = useState<OutlineData | null>(null);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [building, setBuilding] = useState(false);
  const [zeroKeyPrompt, setZeroKeyPrompt] = useState<string | null>(null);
  const [zeroKeyPaste, setZeroKeyPaste] = useState('');

  const [result, setResult] = useState<{
    projectId?: string;
    files: PackFilePreview[];
    triggerPrompts: TriggerPromptOption[];
    providerSummary?: string;
  } | null>(null);
  const [pausedQuota, setPausedQuota] = useState<PausedQuotaState | null>(null);

  useEffect(() => {
    fetch('/api/projects?type=FLOW_MOVIE')
      .then((r) => r.json())
      .then((d) => setSeriesList(d.projects ?? []))
      .catch(() => {});
  }, []);

  const estCredits = Math.round(runtimeMinutes * 240);

  const handleGenerateOutline = async () => {
    setLoadingOutline(true);
    setZeroKeyPrompt(null);
    try {
      const res = await fetch('/api/packs/flow-movie/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          seriesProjectId: seriesProjectId || null,
          aspectRatio,
          runtimeMinutes,
          outlineMode,
          idea,
          manualTitle,
          manualCharacters,
          manualLocations,
          manualPlot,
        }),
      });
      const data = await res.json();
      if (res.status === 429 && data.zeroKeyMode) {
        setZeroKeyPrompt(data.zeroKeyPrompt);
        pushToast({ title: 'All keys busy — Zero-Key prompt ready', tone: 'info' });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Outline generation failed');
      setOutline(data.outline);
      pushToast({ title: 'Editable outline ready', description: `Via ${data.provider}`, tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Outline failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoadingOutline(false);
    }
  };

  const handleBuildPack = async (resumeJobId?: string, pastedJson?: string) => {
    if (!outline) return;
    setBuilding(true);
    setPausedQuota(null);
    try {
      const res = await fetch('/api/packs/flow-movie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingJobId: resumeJobId,
          format,
          seriesGroupId: seriesProjectId || outline.title,
          aspectRatio,
          runtimeMinutes,
          outline,
          zeroKeyPastedJson: pastedJson,
        }),
      });
      const data = await res.json();
      if (res.status === 429 && data.status === 'PAUSED_QUOTA') {
        setPausedQuota(data);
        pushToast({ title: 'Pack paused cleanly at checkpoint', tone: 'info' });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Pack build failed');
      setResult(data);
      pushToast({ title: 'Google Flow Movie Pack compiled (.ZIP)', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Build failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flow Cinema Studio"
        subtitle="Turn a sharp premise into cast and set continuity sheets, ordered shot prompts, and a production archive (.ZIP)."
        badge="BrowserOS neo · FEAICCWS"
      />

      <StudioStarterBanner
        whatYouGet="Consistent character and location dossiers, sequential shot prompts, Turbo-OFF cost guardrails, and Intel QuickSync assembly commands."
        safeNote="1 clip per shot precision"
        samples={[
          {
            label: 'Clockmaker of Marina (Period Thriller)',
            onApply: () => {
              setOutlineMode('ONE_LINE');
              setAspectRatio('16:9');
              setRuntimeMinutes(3);
              setIdea("In 1924 Lagos, an apprentice watchmaker discovers an encrypted cipher hidden inside the governor's pocket watch.");
              pushToast({ title: 'Loaded period thriller premise', tone: 'info' });
            },
          },
          {
            label: 'Room 404 at Hotel Meridian (9:16)',
            onApply: () => {
              setOutlineMode('ONE_LINE');
              setAspectRatio('9:16');
              setRuntimeMinutes(1);
              setIdea('A night clerk is handed a brass key for Room 404, even though the fourth floor was sealed thirty years ago.');
              pushToast({ title: 'Loaded 9:16 noir premise', tone: 'info' });
            },
          },
          {
            label: 'Star Charts of Timbuktu (Drama)',
            onApply: () => {
              setOutlineMode('ONE_LINE');
              setAspectRatio('16:9');
              setRuntimeMinutes(3);
              setIdea('A young astronomer in fifteenth-century Timbuktu races before dawn to safeguard rare celestial manuscripts from an approaching storm.');
              pushToast({ title: 'Loaded historical drama premise', tone: 'info' });
            },
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-5 space-y-4">
          <IdeaSparkWidget
            category="FLOW_MOVIE"
            heading="No movie idea yet? Let AI invent one for you"
            onApplyIdea={(fields) => {
              setOutlineMode('ONE_LINE');
              if (fields.idea) setIdea(fields.idea);
            }}
          />

          {outlineMode === 'ONE_LINE' ? (
            <div>
              <Label>Your 1-Line Movie Idea</Label>
              <Textarea rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <Label>Movie Title</Label>
                <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Title" />
              </div>
              <div>
                <Label>Characters</Label>
                <Textarea rows={2} value={manualCharacters} onChange={(e) => setManualCharacters(e.target.value)} placeholder="Name — visual appearance" />
              </div>
              <div>
                <Label>Locations</Label>
                <Textarea rows={2} value={manualLocations} onChange={(e) => setManualLocations(e.target.value)} placeholder="Location — lighting & mood" />
              </div>
              <div>
                <Label>Plot Beats</Label>
                <Textarea rows={2} value={manualPlot} onChange={(e) => setManualPlot(e.target.value)} placeholder="Beginning, conflict, resolution" />
              </div>
            </div>
          )}

          <AdvancedOptionsToggle title="Customize Format, Aspect Ratio & Runtime">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format</Label>
                <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                  <option value="ONE_OFF">One-off Movie</option>
                  <option value="NEW_SERIES">New Series (Ep 1)</option>
                  <option value="CONTINUE_SERIES">Continue Existing Series</option>
                </Select>
              </div>
              <div>
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}>
                  <option value="16:9">16:9 Widescreen</option>
                  <option value="9:16">9:16 Vertical</option>
                </Select>
              </div>
            </div>

            {format === 'CONTINUE_SERIES' && (
              <div>
                <Label>Prior Saved Series Project</Label>
                <Select value={seriesProjectId} onChange={(e) => setSeriesProjectId(e.target.value)}>
                  <option value="">Select saved series...</option>
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="mb-0">Target Runtime: {runtimeMinutes} min</Label>
                <span className="text-xs font-mono text-[var(--accent-text)]">~{estCredits.toLocaleString()} Flow credits</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={runtimeMinutes}
                onChange={(e) => setRuntimeMinutes(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <Label>Outline Mode</Label>
              <Select value={outlineMode} onChange={(e) => setOutlineMode(e.target.value as 'ONE_LINE' | 'MANUAL')}>
                <option value="ONE_LINE">Write outline from 1-line idea</option>
                <option value="MANUAL">Fill in details myself</option>
              </Select>
            </div>
          </AdvancedOptionsToggle>

          <Button onClick={handleGenerateOutline} disabled={loadingOutline} className="w-full">
            <Wand2 className="h-4 w-4" />
            {loadingOutline ? 'Drafting Outline...' : 'Step 1: Generate Editable Outline'}
          </Button>

          {zeroKeyPrompt && (
            <div className="rounded-xl border border-amber-500/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-400">Zero-Key Outline Prompt</p>
              <pre className="text-[11px] font-mono max-h-36 overflow-auto whitespace-pre-wrap">{zeroKeyPrompt}</pre>
              <Textarea
                rows={3}
                placeholder="Paste JSON outline returned from external AI..."
                value={zeroKeyPaste}
                onChange={(e) => setZeroKeyPaste(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  try {
                    setOutline(JSON.parse(zeroKeyPaste));
                    setZeroKeyPrompt(null);
                  } catch {
                    pushToast({ title: 'Invalid JSON outline', tone: 'error' });
                  }
                }}
              >
                Load Pasted Outline
              </Button>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-[var(--accent-text)]" />
              <h2 className="text-sm font-semibold">Step 2: Editable Outline Review</h2>
            </div>
            {outline && (
              <Button onClick={() => handleBuildPack()} disabled={building}>
                <Sparkles className="h-4 w-4" />
                {building ? 'Compiling .ZIP Pack...' : 'Build Full Movie .ZIP Pack'}
              </Button>
            )}
          </div>

          {!outline ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Click &ldquo;Step 1: Generate Editable Outline&rdquo; on the left. You can review or tweak any character, location, or scene before compiling your `.zip` pack.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input
                  value={outline.title}
                  onChange={(e) => setOutline({ ...outline, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Logline</Label>
                <Textarea
                  rows={2}
                  value={outline.logline}
                  onChange={(e) => setOutline({ ...outline, logline: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                  <div className="text-xs font-bold mb-1.5">Characters ({outline.characters.length})</div>
                  {outline.characters.map((c, i) => (
                    <div key={i} className="text-xs text-[var(--text-secondary)] mb-1.5">
                      <span className="font-semibold text-[var(--text-primary)]">{c.name}:</span> {c.visualIdentity}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                  <div className="text-xs font-bold mb-1.5">Locations as Flow Profiles ({outline.locations.length})</div>
                  {outline.locations.map((l, i) => (
                    <div key={i} className="text-xs text-[var(--text-secondary)] mb-1.5">
                      <span className="font-semibold text-[var(--text-primary)]">{l.name}:</span> {l.visualProfile}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {outline.scenes.map((sc, idx) => (
                  <div key={sc.sceneNumber} className="rounded-xl border bg-[var(--bg-elevated)] p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Scene {String(sc.sceneNumber).padStart(2, '0')} — {sc.locationName} ({sc.shotCount} shots)</span>
                    </div>
                    <Input
                      value={sc.title}
                      onChange={(e) => {
                        const next = [...outline.scenes];
                        next[idx] = { ...sc, title: e.target.value };
                        setOutline({ ...outline, scenes: next });
                      }}
                    />
                    <Textarea
                      rows={2}
                      value={sc.summary}
                      onChange={(e) => {
                        const next = [...outline.scenes];
                        next[idx] = { ...sc, summary: e.target.value };
                        setOutline({ ...outline, scenes: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {(result || pausedQuota) && (
        <div className="space-y-4">
          <PackResultViewer
            projectId={result?.projectId}
            title={outline?.title || 'Google Flow Movie Pack'}
            files={result?.files ?? []}
            triggerPrompts={result?.triggerPrompts ?? []}
            providerSummary={result?.providerSummary}
            pausedQuota={pausedQuota}
            onRetryResume={() => pausedQuota && handleBuildPack(pausedQuota.jobId)}
            onZeroKeyImported={(pasted) => handleBuildPack(pausedQuota?.jobId, pasted)}
          />
          {result?.projectId && (
            <NextStepCard
              title="Next: Prepare Your Safe Release Package"
              description="Once your clips are assembled, generate your SEO title, store link block, and Safe Release instructions."
              href="/publish-packs"
              cta="Open Safe Release Desk"
            />
          )}
        </div>
      )}
    </div>
  );
}
