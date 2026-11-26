'use client';

import React, { useEffect, useState } from 'react';
import { Compass, Sparkles } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from '@/components/ui';
import { PackFilePreview, PackResultViewer } from '@/components/PackResultViewer';
import { useToast } from '@/components/ToastProvider';

interface SavedProjectOption {
  id: string;
  title: string;
  type: string;
}

export default function StoreFunnelPage() {
  const { pushToast } = useToast();
  const [savedProducts, setSavedProducts] = useState<SavedProjectOption[]>([]);
  const [attachedProjectId, setAttachedProjectId] = useState('');
  const [productTitle, setProductTitle] = useState('The 30-Day Cashflow & Side-Income Reset');
  const [productSummary, setProductSummary] = useState('A practical ebook + formula spreadsheet bundle helping beginners budget and launch a $15 digital product.');
  const [targetAudience, setTargetAudience] = useState('Young professionals and creators seeking extra monthly income');
  const [platform, setPlatform] = useState<'PAYHIP' | 'SELAR' | 'GUMROAD' | 'SHOPIFY'>('PAYHIP');
  const [storeUrl, setStoreUrl] = useState('https://payhip.com/ntkhub/cashflow-reset');
  const [starterPriceUsd, setStarterPriceUsd] = useState(15);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    projectId: string;
    files: PackFilePreview[];
    providerSummary: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        const prods = (d.projects ?? []).filter((p: SavedProjectOption) =>
          ['EBOOK', 'SPREADSHEET', 'PLANNER', 'JOURNAL'].includes(p.type)
        );
        setSavedProducts(prods);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/products/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachedProjectId: attachedProjectId || null,
          productTitle,
          productSummary,
          targetAudience,
          platform,
          storeUrl,
          starterPriceUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate store funnel');
      setResult(data);
      pushToast({ title: 'Store Copy & 10-Video Funnel Pack ready', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront Copy, Funnel & Promo Script Builder"
        subtitle='Generate zero-monthly-fee storefront copy (Payhip, Selar, Gumroad) or Shopify pages, $7–$25 pricing ladders, and a "One Product, Many Videos" 10-video organic YouTube plan.'
        badge="One Product, Many Videos"
      />

      <Card>
        <form onSubmit={handleGenerate} className="space-y-4">
          {savedProducts.length > 0 && (
            <div>
              <Label>Attach Created Digital Product (Optional)</Label>
              <Select
                value={attachedProjectId}
                onChange={(e) => {
                  const id = e.target.value;
                  setAttachedProjectId(id);
                  const found = savedProducts.find((p) => p.id === id);
                  if (found) setProductTitle(found.title);
                }}
              >
                <option value="">Custom / Manual product details</option>
                {savedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.type})
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Product Title</Label>
              <Input value={productTitle} onChange={(e) => setProductTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Storefront Platform</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
                <option value="PAYHIP">Payhip ($0/mo free tier)</option>
                <option value="SELAR">Selar ($0/mo Africa & Global)</option>
                <option value="GUMROAD">Gumroad ($0/mo)</option>
                <option value="SHOPIFY">Shopify</option>
              </Select>
            </div>
            <div>
              <Label>Starter Price ($7–$25)</Label>
              <Input
                type="number"
                min={3}
                max={99}
                value={starterPriceUsd}
                onChange={(e) => setStarterPriceUsd(Number(e.target.value) || 15)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Target Audience</Label>
              <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
            </div>
            <div>
              <Label>Permanent Store Link</Label>
              <Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Product Summary & Core Promise</Label>
            <Textarea rows={2} value={productSummary} onChange={(e) => setProductSummary(e.target.value)} required />
          </div>

          <Button type="submit" disabled={loading}>
            <Compass className="h-4 w-4" />
            {loading ? 'Writing Funnel & 10-Video Plan...' : 'Build Storefront Copy & Promo Scripts .ZIP'}
          </Button>
        </form>
      </Card>

      {result && (
        <PackResultViewer
          projectId={result.projectId}
          title={`${productTitle} (${platform} Funnel)`}
          files={result.files}
          providerSummary={result.providerSummary}
        />
      )}
    </div>
  );
}
