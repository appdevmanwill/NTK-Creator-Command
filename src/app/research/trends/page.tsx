'use client';

import React, { useState } from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, Input, Label, PageHeader, Select } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface TrendResponse {
  keyword: string;
  region: string;
  window: string;
  googleTrendsYoutubeUrl: string;
  providerSummary: string;
  youtubeVelocity: { sampleCount: number; recentVideos: Array<{ title: string; publishedAt: string }> } | null;
  analysis: {
    verdict: string;
    seasonality: string;
    monetizationFit: string;
    subTopics: string[];
    momentumSeries: Array<{ period: string; interest: number }>;
  };
}

export default function TrendFinderPage() {
  const { pushToast } = useToast();
  const [keyword, setKeyword] = useState('budget planner');
  const [region, setRegion] = useState('US');
  const [windowRange, setWindowRange] = useState<'12m' | '5y'>('5y');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrendResponse | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/research/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, region, window: windowRange }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Trend check failed');
      setData(json);
      pushToast({ title: 'Trend analysis complete', tone: 'success' });
    } catch (err) {
      pushToast({ title: 'Failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demand & Seasonality Radar"
        subtitle="Distinguish durable evergreen search demand from temporary spikes, inspect momentum curves, and jump straight to YouTube Search Trends."
      />

      <Card>
        <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Topic / Keyword</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} required />
          </div>
          <div>
            <Label>Region</Label>
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="US">United States (US)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="NG">Nigeria (NG)</option>
              <option value="GLOBAL">Worldwide</option>
            </Select>
          </div>
          <div>
            <Label>Window</Label>
            <Select value={windowRange} onChange={(e) => setWindowRange(e.target.value as '12m' | '5y')}>
              <option value="5y">5 Years (Evergreen Check)</option>
              <option value="12m">12 Months</option>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="md:col-span-4 w-fit" data-testid="analyze-trend-btn">
            <TrendingUp className="h-4 w-4" />
            {loading ? 'Analyzing Trend...' : 'Analyze YouTube Search Trend'}
          </Button>
        </form>
      </Card>

      {data && (
        <div className="space-y-5" data-testid="trend-result">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Trend Verdict: {data.keyword}</h2>
                <p className="text-xs text-[var(--text-secondary)]">Via {data.providerSummary}</p>
              </div>
              <a
                href={data.googleTrendsYoutubeUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="google-trends-link"
              >
                <Button variant="secondary" size="sm">
                  Open in Google Trends (YouTube Search) <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>

            <p className="text-sm text-[var(--text-primary)]">{data.analysis.verdict}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                <div className="font-semibold text-[var(--accent-text)] mb-1">Seasonality</div>
                <p className="text-[var(--text-secondary)]">{data.analysis.seasonality}</p>
              </div>
              <div className="rounded-xl border bg-[var(--bg-elevated)] p-3">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Digital Product Fit</div>
                <p className="text-[var(--text-secondary)]">{data.analysis.monetizationFit}</p>
              </div>
            </div>

            <div className="h-60 rounded-xl border bg-[var(--bg-elevated)] p-3">
              <div className="text-xs font-semibold mb-2">Estimated Search Interest Trajectory</div>
              <ResponsiveContainer width="100%" height="88%">
                <AreaChart data={data.analysis.momentumSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(159,152,140,0.22)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="interest" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="text-xs font-bold mb-2">Low-Competition Sub-Topics</div>
              <div className="flex flex-wrap gap-2">
                {data.analysis.subTopics.map((sub) => (
                  <span key={sub} className="rounded-full border bg-[var(--bg-elevated)] px-3 py-1 text-xs">
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
