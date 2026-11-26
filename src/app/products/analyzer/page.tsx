'use client';

import React, { useState } from 'react';
import { Globe, Search, Star } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface StoreResult {
  origin: string;
  pageTitle: string;
  isShopify: boolean;
  productCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  categories: Array<{ name: string; count: number }>;
  topProducts: Array<{ title: string; product_type: string; price: number }>;
  aiAnalysis: { positioningSummary?: string; opportunities?: string[] };
}

interface ProductResult {
  url: string;
  fetchNote: string;
  providerSummary: string;
  report: {
    productTitle: string;
    replicationScore: number;
    marketDemand: string;
    competitionLevel: string;
    pricingEvaluation: string;
    differentiationAngles: string[];
  };
}

export default function ProductAndStoreAnalyzerPage() {
  const { pushToast } = useToast();
  const [storeUrl, setStoreUrl] = useState('https://www.allbirds.com');
  const [productUrl, setProductUrl] = useState('https://payhip.com');
  const [loadingStore, setLoadingStore] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [storeRes, setStoreRes] = useState<StoreResult | null>(null);
  const [prodRes, setProdRes] = useState<ProductResult | null>(null);

  const analyzeStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingStore(true);
    try {
      const res = await fetch('/api/products/analyze-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: storeUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Store analysis failed');
      setStoreRes(data);
      pushToast({ title: 'Storefront analyzed', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Store analysis failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoadingStore(false);
    }
  };

  const analyzeProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProduct(true);
    try {
      const res = await fetch('/api/products/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Product analysis failed');
      setProdRes(data);
      pushToast({ title: 'Product scored & differentiation angles ready', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Product analysis failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoadingProduct(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market & Storefront Audit"
        subtitle="Inspect public Shopify /products.json catalogs or score live digital products for 1–5 Replication Potential and positioning gaps."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[var(--accent-text)]" />
            <h2 className="text-sm font-semibold">Competitor Store Analyzer (Shopify / Public URL)</h2>
          </div>
          <form onSubmit={analyzeStore} className="space-y-3">
            <div>
              <Label>Store URL</Label>
              <Input value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loadingStore}>
              <Search className="h-4 w-4" />
              {loadingStore ? 'Inspecting Store...' : 'Analyze Store Catalog'}
            </Button>
          </form>

          {storeRes && (
            <div className="space-y-3 pt-3 border-t text-xs" data-testid="store-analysis-result">
              <div className="font-bold text-sm">{storeRes.pageTitle}</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-[var(--bg-elevated)] p-2">
                  <div className="text-[var(--text-secondary)]">Products</div>
                  <div className="font-bold text-base">{storeRes.productCount}</div>
                </div>
                <div className="rounded-lg border bg-[var(--bg-elevated)] p-2">
                  <div className="text-[var(--text-secondary)]">Avg Price</div>
                  <div className="font-bold text-base">${storeRes.avgPrice}</div>
                </div>
                <div className="rounded-lg border bg-[var(--bg-elevated)] p-2">
                  <div className="text-[var(--text-secondary)]">Range</div>
                  <div className="font-bold text-base">${storeRes.minPrice}–${storeRes.maxPrice}</div>
                </div>
              </div>
              {storeRes.aiAnalysis?.positioningSummary && (
                <p className="text-[var(--text-secondary)]">{storeRes.aiAnalysis.positioningSummary}</p>
              )}
              {storeRes.aiAnalysis?.opportunities?.length ? (
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                  {storeRes.aiAnalysis.opportunities.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold">Live Digital Product Analyzer</h2>
          </div>
          <form onSubmit={analyzeProduct} className="space-y-3">
            <div>
              <Label>Digital Product URL</Label>
              <Input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loadingProduct} data-testid="analyze-product-btn">
              <Search className="h-4 w-4" />
              {loadingProduct ? 'Scoring Product...' : 'Analyze Product & Score'}
            </Button>
          </form>

          {prodRes && (
            <div className="space-y-3 pt-3 border-t text-xs" data-testid="product-analysis-result">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">{prodRes.report.productTitle}</span>
                <span className="rounded-full bg-[var(--accent-soft)] border border-[var(--border-accent)] px-2.5 py-0.5 font-semibold text-[var(--accent-text)]">
                  Replication Score: {prodRes.report.replicationScore}/5
                </span>
              </div>
              <div className="space-y-1 text-[var(--text-secondary)]">
                <p><strong>Demand:</strong> {prodRes.report.marketDemand}</p>
                <p><strong>Competition:</strong> {prodRes.report.competitionLevel}</p>
                <p><strong>Pricing:</strong> {prodRes.report.pricingEvaluation}</p>
              </div>
              <div>
                <div className="font-semibold text-[var(--text-primary)] mb-1">5 Concrete Differentiation Angles</div>
                <ol className="list-decimal pl-4 space-y-1 text-[var(--text-secondary)]">
                  {prodRes.report.differentiationAngles.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
