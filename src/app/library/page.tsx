'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, FolderArchive, Search, Trash2 } from 'lucide-react';
import { Button, Card, Input, PageHeader, Select, StatusBadge } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface LibraryProject {
  id: string;
  type: string;
  title: string;
  filesJson: string;
  createdAt: string;
}

export default function LibraryPage() {
  const { pushToast } = useToast();
  const [projects, setProjects] = useState<LibraryProject[]>([]);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [q, setQ] = useState('');

  const loadLibrary = useCallback(async () => {
    const params = new URLSearchParams();
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/projects?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    setProjects(data.projects ?? []);
  }, [typeFilter, q]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    pushToast({ title: 'Artifact deleted', tone: 'info' });
    await loadLibrary();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editions & Pack Archive"
        subtitle="Inspect, download, or manage every generated agent pack (.zip), digital edition (.pdf / .xlsx), and release dossier stored on your machine."
        badge={`${projects.length} Items`}
      />

      <Card className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-[var(--text-secondary)]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search packs & products..." className="pl-9" />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-60">
          <option value="ALL">All Types</option>
          <option value="FLOW_MOVIE">FLOW_MOVIE</option>
          <option value="FLOW_BULK">FLOW_BULK</option>
          <option value="KAGGLE_COLAB">KAGGLE_COLAB</option>
          <option value="BRAND_PACK">BRAND_PACK</option>
          <option value="AD_SPY_PACK">AD_SPY_PACK</option>
          <option value="UNIVERSAL_PACK">UNIVERSAL_PACK</option>
          <option value="EBOOK">EBOOK</option>
          <option value="SPREADSHEET">SPREADSHEET</option>
          <option value="PLANNER">PLANNER</option>
          <option value="JOURNAL">JOURNAL</option>
          <option value="STORE_FUNNEL">STORE_FUNNEL</option>
          <option value="PUBLISH_PACK">PUBLISH_PACK</option>
          <option value="OAUTH_PACK">OAUTH_PACK</option>
        </Select>
      </Card>

      {projects.length === 0 ? (
        <Card className="text-center py-10 text-xs text-[var(--text-secondary)]">
          <FolderArchive className="h-8 w-8 mx-auto mb-2 opacity-60" />
          No artifacts match your filter yet.
        </Card>
      ) : (
        <div className="space-y-3" data-testid="library-list">
          {projects.map((p) => {
            let fileCount = 1;
            try {
              fileCount = (JSON.parse(p.filesJson) as unknown[]).length;
            } catch {
              fileCount = 1;
            }
            return (
              <Card key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.type} />
                    <span className="font-bold text-sm truncate">{p.title}</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] font-mono">
                    {fileCount} file(s) • {new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`/api/projects/${p.id}/download`} download>
                    <Button size="sm">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} aria-label="Delete artifact">
                    <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
