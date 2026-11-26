'use client';

import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer, TriggerPromptOption } from '@/components/PackResultViewer';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

const PRESETS = [
  { name: 'Suno', url: 'https://suno.com' },
  { name: 'Google Flow Music', url: 'https://labs.google/fx/tools/flow' },
  { name: 'Kling AI', url: 'https://klingai.com' },
  { name: 'Payhip', url: 'https://payhip.com' },
  { name: 'Selar', url: 'https://selar.com' },
  { name: 'Gumroad', url: 'https://gumroad.com' },
];

export default function UniversalPackPage() {
  const { pushToast } = useToast();
  const [platformName, setPlatformName] = useState('Payhip');
  const [platformUrl, setPlatformUrl] = useState('https://payhip.com');
  const [creativeGoal, setCreativeGoal] = useState('Create a $0-monthly-fee storefront listing for a digital budget spreadsheet & ebook bundle with instant download delivery.');
  const [targetAgent, setTargetAgent] = useState<'ANTIGRAVITY' | 'CODEX'>('ANTIGRAVITY');
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
      const res = await fetch('/api/packs/universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformName, platformUrl, creativeGoal, targetAgent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build universal playbook');
      setResult(data);
      pushToast({ title: 'Universal Playbook .ZIP compiled', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Build failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universal Playbook Engine"
        subtitle="Turn any creative, audio, video, or storefront website into a structured Antigravity or Codex execution playbook with BrowserOS neo guardrails."
      />

      <Card className="space-y-4">
        <IdeaSparkWidget
          category="UNIVERSAL_PLAYBOOK"
          heading="Need an idea for which website & task to automate?"
          onApplyIdea={(fields) => {
            if (fields.platformName) setPlatformName(fields.platformName);
            if (fields.platformUrl) setPlatformUrl(fields.platformUrl);
            if (fields.creativeGoal) setCreativeGoal(fields.creativeGoal);
          }}
        />

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                setPlatformName(p.name);
                setPlatformUrl(p.url);
              }}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 text-xs hover:border-[var(--border-accent)]"
            >
              {p.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Platform Name</Label>
              <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} required />
            </div>
            <div>
              <Label>Platform URL</Label>
              <Input value={platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} required />
            </div>
            <div>
              <Label>Target Agent</Label>
              <Select value={targetAgent} onChange={(e) => setTargetAgent(e.target.value as 'ANTIGRAVITY' | 'CODEX')}>
                <option value="ANTIGRAVITY">Google Antigravity</option>
                <option value="CODEX">OpenAI Codex</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Creative / Automation Goal</Label>
            <Textarea rows={3} value={creativeGoal} onChange={(e) => setCreativeGoal(e.target.value)} required />
          </div>
          <Button type="submit" disabled={loading}>
            <Globe className="h-4 w-4" />
            {loading ? 'Building Playbook...' : 'Compile Universal Playbook .ZIP'}
          </Button>
        </form>
      </Card>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={`${platformName} Agent Playbook`}
          files={result.files}
          triggerPrompts={result.triggerPrompts}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
