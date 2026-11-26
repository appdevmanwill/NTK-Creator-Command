'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Plus, Radar, RefreshCw, Search } from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, StatusBadge } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface ChannelItem {
  id: string;
  name: string;
  handle: string;
  url: string;
  niche: string;
  videoStyle: string;
  subscribers: number;
  uploadsPerWeek: number;
  avgLengthMin: number;
  startedDate: string;
  estMonthlyViews: number;
  estMonthlyAdSense: number;
  monetizationConfirmed: boolean;
  sellsDigitalProducts: boolean;
  digitalProductUrl: string | null;
  digitalProductType: string | null;
  notes: string | null;
}

interface BenchmarkItem {
  niche: string;
  channels: number;
  avgMonthlyAdSense: number;
  digitalProductRate: number;
}

export default function FacelessFinderPage() {
  const { pushToast } = useToast();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkItem[]>([]);
  const [totalInDb, setTotalInDb] = useState(0);

  const [q, setQ] = useState('');
  const [niche, setNiche] = useState('ALL');
  const [style, setStyle] = useState('ALL');
  const [monetizedOnly, setMonetizedOnly] = useState(false);
  const [startedThisYear, setStartedThisYear] = useState(false);
  const [digitalProductsOnly, setDigitalProductsOnly] = useState(false);
  const [sort, setSort] = useState('earnings');

  const [addInput, setAddInput] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadChannels = useCallback(async () => {
    const params = new URLSearchParams({
      q,
      niche,
      style,
      monetized: String(monetizedOnly),
      thisYear: String(startedThisYear),
      digitalProducts: String(digitalProductsOnly),
      sort,
    });
    const res = await fetch(`/api/research/channels?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    setChannels(data.channels ?? []);
    setBenchmarks(data.benchmarks ?? []);
    setTotalInDb(data.totalInDb ?? 0);
  }, [q, niche, style, monetizedOnly, startedThisYear, digitalProductsOnly, sort]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleAddOrSyncUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/research/channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrHandle: addInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      pushToast({ title: `Added/Synced ${data.channel.name}`, description: `Via ${data.syncSource}`, tone: 'success' });
      setAddInput('');
      await loadChannels();
    } catch (err) {
      pushToast({ title: 'Add failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleSyncRow = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch('/api/research/channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      pushToast({ title: `Synced ${data.channel.name}`, description: `Via ${data.syncSource}`, tone: 'success' });
      await loadChannels();
    } catch (err) {
      pushToast({ title: 'Sync failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Faceless Finder"
        subtitle="Track profitable faceless channels, spot digital product monetization funnels (Gumroad, Payhip, Selar, Shopify), and sync live stats locally."
        badge={`${totalInDb} Tracked`}
      />

      {benchmarks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {benchmarks.map((b) => (
            <Card key={b.niche} className="p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-indigo-400 truncate">{b.niche}</div>
              <div className="text-base font-bold">${b.avgMonthlyAdSense.toLocaleString()}/mo</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {b.channels} ch • {b.digitalProductRate}% sell products
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="space-y-4">
        <form onSubmit={handleAddOrSyncUrl} className="flex flex-col sm:flex-row gap-2.5">
          <Input
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            placeholder="Add channel by YouTube URL or @handle (auto-scans for digital store links)..."
          />
          <Button type="submit" disabled={adding} className="shrink-0">
            <Plus className="h-4 w-4" />
            {adding ? 'Syncing...' : 'Add & Scan Channel'}
          </Button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t">
          <div>
            <Label>Search</Label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-[var(--text-secondary)]" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, product, notes..." className="pl-8" />
            </div>
          </div>
          <div>
            <Label>Niche</Label>
            <Select value={niche} onChange={(e) => setNiche(e.target.value)}>
              <option value="ALL">All Niches</option>
              <option value="Money & Finance">Money & Finance</option>
              <option value="History">History</option>
              <option value="Stories">Stories</option>
              <option value="Science & Space">Science & Space</option>
              <option value="Stickman Explainers">Stickman Explainers</option>
              <option value="AI Movies">AI Movies</option>
            </Select>
          </div>
          <div>
            <Label>Video Style</Label>
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="ALL">All Styles</option>
              <option value="Stickman">Stickman</option>
              <option value="Animated">Animated</option>
              <option value="Documentary">Documentary</option>
              <option value="AI Avatar">AI Avatar</option>
              <option value="Whiteboard">Whiteboard</option>
              <option value="AI Movie">AI Movie</option>
            </Select>
          </div>
          <div>
            <Label>Sort By</Label>
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="earnings">Est. Monthly Earnings</option>
              <option value="subscribers">Subscribers</option>
              <option value="views">Monthly Views</option>
              <option value="newest">Newest Started</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={monetizedOnly} onChange={(e) => setMonetizedOnly(e.target.checked)} />
            Monetization Confirmed
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={startedThisYear} onChange={(e) => setStartedThisYear(e.target.checked)} />
            Started This Year ({new Date().getFullYear()})
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo-400 cursor-pointer">
            <input
              type="checkbox"
              checked={digitalProductsOnly}
              onChange={(e) => setDigitalProductsOnly(e.target.checked)}
              data-testid="filter-digital-products"
            />
            Sells Digital Products
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="channels-grid">
        {channels.map((ch) => (
          <Card key={ch.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold">{ch.name}</h3>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">{ch.handle}</span>
                  {ch.monetizationConfirmed && <StatusBadge status="HEALTHY" />}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {ch.niche} • {ch.videoStyle} • Started {ch.startedDate}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => handleSyncRow(ch.id)} disabled={syncingId === ch.id}>
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingId === ch.id ? 'animate-spin' : ''}`} />
                </Button>
                <a href={ch.url} target="_blank" rel="noreferrer" className="p-1.5 text-[var(--text-secondary)] hover:text-indigo-400">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border bg-[var(--bg-elevated)] p-2">
                <div className="text-[var(--text-secondary)]">Subscribers</div>
                <div className="font-bold">{ch.subscribers.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border bg-[var(--bg-elevated)] p-2">
                <div className="text-[var(--text-secondary)]">Monthly Views</div>
                <div className="font-bold">{ch.estMonthlyViews.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border bg-[var(--bg-elevated)] p-2">
                <div className="text-[var(--text-secondary)]">Est. AdSense</div>
                <div className="font-bold text-emerald-400">${ch.estMonthlyAdSense.toLocaleString()}/mo</div>
              </div>
            </div>

            {ch.sellsDigitalProducts && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs flex items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-indigo-400">Digital Product:</span>{' '}
                  <span>{ch.digitalProductType || 'Store Offer'}</span>
                </div>
                {ch.digitalProductUrl && (
                  <a href={ch.digitalProductUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0">
                    Store <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {ch.notes && <p className="text-xs text-[var(--text-secondary)]">{ch.notes}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}
