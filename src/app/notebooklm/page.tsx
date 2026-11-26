'use client';

import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer } from '@/components/PackResultViewer';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

export default function NotebookLmBlueprintPage() {
  const { pushToast } = useToast();
  const [channelName, setChannelName] = useState('Meridian Ledger House');
  const [niche, setNiche] = useState('Personal Finance & Micro Digital Editions');
  const [targetAudience, setTargetAudience] = useState('Independent earners building savings habits and calm cashflow');
  const [flagshipProduct, setFlagshipProduct] = useState("The Quiet Compounder's Ledger ($15)");
  const [storePlatform, setStorePlatform] = useState('Payhip');
  const [visualStyle, setVisualStyle] = useState('Matte obsidian & champagne gold editorial illustration with crisp serif cover typography');
  const [uploadCadence, setUploadCadence] = useState('3 videos/week');
  const [googleAccountAgeNote, setGoogleAccountAgeNote] = useState('Launching on an aged Google account for initial YouTube trust & consistent cover branding');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    sequentialPrompt: string;
    files: PackFilePreview[];
    providerSummary: string;
  } | null>(null);

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/notebooklm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName,
          niche,
          targetAudience,
          flagshipProduct,
          storePlatform,
          visualStyle,
          uploadCadence,
          googleAccountAgeNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate blueprint');
      setResult(data);
      pushToast({ title: 'NotebookLM Sequential Blueprint Ready', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Build failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="NotebookLM Channel Bible"
        subtitle='Compile a structured Channel Bible outputting the sequential "type next" launch prompt with aged Google account trust and cohesive cover branding.'
        badge='Sequential "type next"'
      />

      <Card className="space-y-4">
        <IdeaSparkWidget
          category="NOTEBOOKLM_CHANNEL"
          heading="Starting completely from scratch? Spark a full channel + product combo"
          onApplyIdea={(fields) => {
            if (fields.channelName) setChannelName(fields.channelName);
            if (fields.niche) setNiche(fields.niche);
            if (fields.targetAudience) setTargetAudience(fields.targetAudience);
            if (fields.flagshipProduct) setFlagshipProduct(fields.flagshipProduct);
          }}
        />
        <form onSubmit={handleBuild} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Channel Name</Label>
            <Input value={channelName} onChange={(e) => setChannelName(e.target.value)} required />
          </div>
          <div>
            <Label>Niche</Label>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} required />
          </div>
          <div>
            <Label>Target Audience</Label>
            <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} required />
          </div>
          <div>
            <Label>Flagship Digital Product</Label>
            <Input value={flagshipProduct} onChange={(e) => setFlagshipProduct(e.target.value)} required />
          </div>
          <div>
            <Label>Storefront Platform</Label>
            <Input value={storePlatform} onChange={(e) => setStorePlatform(e.target.value)} />
          </div>
          <div>
            <Label>Upload Cadence</Label>
            <Input value={uploadCadence} onChange={(e) => setUploadCadence(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Visual & Cover Branding Rule</Label>
            <Input value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>YouTube Account Trust & Launch Notes</Label>
            <Textarea rows={2} value={googleAccountAgeNote} onChange={(e) => setGoogleAccountAgeNote(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading} data-testid="build-notebooklm-btn">
              <BookOpen className="h-4 w-4" />
              {loading ? 'Generating Sequential Blueprint...' : 'Generate NotebookLM Sequential Blueprint .ZIP'}
            </Button>
          </div>
        </form>
      </Card>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={`${channelName} — NotebookLM Sequential Blueprint`}
          files={result.files}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
