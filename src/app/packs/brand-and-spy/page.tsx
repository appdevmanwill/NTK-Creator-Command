'use client';

import React, { useState } from 'react';
import { Radar, Sparkles } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select } from '@/components/ui';
import { PackFilePreview, PackResultViewer, TriggerPromptOption } from '@/components/PackResultViewer';
import { IdeaSparkWidget } from '@/components/IdeaSparkWidget';
import { useToast } from '@/components/ToastProvider';

export default function BrandAndSpyPage() {
  const { pushToast } = useToast();
  const [mode, setMode] = useState<'BRAND_PACK' | 'AD_SPY_PACK'>('BRAND_PACK');
  const [brandOrKeyword, setBrandOrKeyword] = useState('Smart Budget Academy');
  const [niche, setNiche] = useState('Personal Finance & Digital Templates');
  const [mascotIdea, setMascotIdea] = useState('Friendly cobalt-blue owl wearing minimal reading glasses');
  const [uploadScheduleText, setUploadScheduleText] = useState('New Videos Every Tuesday & Friday');
  const [textOnlyBanner, setTextOnlyBanner] = useState(false);
  const [targetCountry, setTargetCountry] = useState('US');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    files: PackFilePreview[];
    triggerPrompts?: TriggerPromptOption[];
    providerSummary: string;
  } | null>(null);

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/packs/brand-and-spy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          brandOrKeyword,
          niche,
          mascotIdea,
          uploadScheduleText,
          textOnlyBanner,
          targetCountry,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pack build failed');
      setResult(data);
      pushToast({ title: `${mode === 'BRAND_PACK' ? 'Brand & Mascot' : 'Ad Spy'} pack generated`, tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand/Mascot & Competitor Ad Spy Packs"
        subtitle="Generate consistent logo, PFP, banner, mascot, and 16:9 thumbnail prompts OR compile $0 Meta Ad Library & Google Ads Transparency research packs."
        badge="Zero Paid Ad Tools"
      />

      <Card className="space-y-4">
        <IdeaSparkWidget
          category={mode === 'BRAND_PACK' ? 'BRAND_MASCOT' : 'AD_SPY'}
          heading="Need a brand name, mascot, or product keyword to spy on?"
          onApplyIdea={(fields) => {
            if (fields.brandOrKeyword) setBrandOrKeyword(fields.brandOrKeyword);
            if (fields.niche) setNiche(fields.niche);
            if (fields.mascotIdea) setMascotIdea(fields.mascotIdea);
          }}
        />
        <form onSubmit={handleBuild} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'BRAND_PACK' ? 'primary' : 'secondary'}
              onClick={() => setMode('BRAND_PACK')}
            >
              <Sparkles className="h-4 w-4" /> Brand, Mascot & Thumbnails
            </Button>
            <Button
              type="button"
              variant={mode === 'AD_SPY_PACK' ? 'primary' : 'secondary'}
              onClick={() => setMode('AD_SPY_PACK')}
            >
              <Radar className="h-4 w-4" /> Ad Library & Store Spy Pack
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{mode === 'BRAND_PACK' ? 'Channel / Brand Name' : 'Digital Product Keyword'}</Label>
              <Input value={brandOrKeyword} onChange={(e) => setBrandOrKeyword(e.target.value)} required />
            </div>
            <div>
              <Label>Niche / Category</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} required />
            </div>
          </div>

          {mode === 'BRAND_PACK' ? (
            <div className="space-y-3">
              <div>
                <Label>Recurring Mascot Concept</Label>
                <Input value={mascotIdea} onChange={(e) => setMascotIdea(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <Label>Banner Upload Schedule Text</Label>
                  <Input
                    value={uploadScheduleText}
                    onChange={(e) => setUploadScheduleText(e.target.value)}
                    disabled={textOnlyBanner}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={textOnlyBanner}
                    onChange={(e) => setTextOnlyBanner(e.target.checked)}
                  />
                  Text-only clean banner (omit upload schedule)
                </label>
              </div>
            </div>
          ) : (
            <div className="max-w-xs">
              <Label>Target Country Code</Label>
              <Select value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)}>
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="CA">Canada (CA)</option>
                <option value="NG">Nigeria (NG)</option>
                <option value="ALL">All Countries</option>
              </Select>
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? 'Generating Pack...' : `Build ${mode === 'BRAND_PACK' ? 'Brand & Mascot' : 'Ad Spy'} .ZIP`}
          </Button>
        </form>
      </Card>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={brandOrKeyword}
          files={result.files}
          triggerPrompts={result.triggerPrompts}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
