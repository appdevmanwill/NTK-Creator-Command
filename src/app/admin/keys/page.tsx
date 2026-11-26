'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FolderSearch,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button, Card, Input, Label, PageHeader, Select, StatusBadge } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface VaultKey {
  id: string;
  label: string;
  provider: string;
  maskedKey: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  priority: number;
  status: string;
  cooldownUntil: string | null;
  exhaustedUntil: string | null;
  totalRequests: number;
  totalFailures: number;
  lastError: string | null;
  lastUsedAt: string | null;
}

interface FailoverLogEntry {
  id: string;
  taskType: string;
  fromProvider: string;
  fromModel: string;
  toProvider: string | null;
  toModel: string | null;
  reason: string;
  httpStatus: number | null;
  createdAt: string;
}

export default function AdminKeysPage() {
  const { pushToast } = useToast();
  const [keys, setKeys] = useState<VaultKey[]>([]);
  const [logs, setLogs] = useState<FailoverLogEntry[]>([]);
  const [strategy, setStrategy] = useState<'PRIORITY_FAILOVER' | 'ROUND_ROBIN'>('PRIORITY_FAILOVER');
  const [zeroKeyEnabled, setZeroKeyEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<Record<string, string[]>>({});
  const [rescanning, setRescanning] = useState(false);

  // Add key form
  const [label, setLabel] = useState('');
  const [provider, setProvider] = useState('GEMINI');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [priority, setPriority] = useState('10');
  const [saving, setSaving] = useState(false);

  const fetchVault = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/keys', { cache: 'no-store' });
      const data = await res.json();
      setKeys(data.keys ?? []);
      setLogs(data.failoverLogs ?? []);
      if (data.config?.rotationStrategy) setStrategy(data.config.rotationStrategy);
      if (typeof data.config?.zeroKeyFallbackEnabled === 'boolean') {
        setZeroKeyEnabled(data.config.zeroKeyFallbackEnabled);
      }
    } catch {
      pushToast({ title: 'Failed to load Admin Key Vault', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          provider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim() || null,
          defaultModel: defaultModel.trim() || null,
          priority: Number(priority) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save key');
      pushToast({ title: 'API key encrypted & saved to Vault', tone: 'success' });
      setLabel('');
      setApiKey('');
      setBaseUrl('');
      setDefaultModel('');
      await fetchVault();
    } catch (err) {
      pushToast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/admin/keys/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setDiscoveredModels((prev) => ({ ...prev, [id]: data.models }));
      }
      pushToast({
        title: data.ok ? 'Key Verified Live!' : 'Key Verification Failed',
        description: `${data.message}${data.models?.length ? ` (${data.models.length} models fetched)` : ''}`,
        tone: data.ok ? 'success' : 'error',
      });
      await fetchVault();
    } catch {
      pushToast({ title: 'Test failed', tone: 'error' });
    } finally {
      setTestingId(null);
    }
  };

  const handleRescan = async () => {
    setRescanning(true);
    try {
      const res = await fetch('/api/admin/keys/rescan', { method: 'POST' });
      const data = await res.json();
      pushToast({
        title: 'FILES Re-Scan Complete',
        description: `Imported ${data.imported ?? 0} new, ${data.skippedExisting ?? 0} existing.`,
        tone: 'success',
      });
      await fetchVault();
    } catch {
      pushToast({ title: 'Re-scan failed', tone: 'error' });
    } finally {
      setRescanning(false);
    }
  };

  const handleConfigChange = async (nextStrategy: 'PRIORITY_FAILOVER' | 'ROUND_ROBIN', nextZk: boolean) => {
    setStrategy(nextStrategy);
    setZeroKeyEnabled(nextZk);
    await fetch('/api/admin/keys/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotationStrategy: nextStrategy, zeroKeyFallbackEnabled: nextZk }),
    });
    pushToast({ title: 'Router configuration updated', tone: 'success' });
  };

  const handlePatchKey = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/admin/keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await fetchVault();
  };

  const handleDeleteKey = async (id: string) => {
    await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
    pushToast({ title: 'Key removed from Vault', tone: 'info' });
    await fetchVault();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin API Key Vault & Auto-Failover Router"
        subtitle="AES-256-GCM encrypted local key storage with automatic 429 cooldown rotation, multi-provider failover, and live model discovery."
        badge="AES-256-GCM"
        actions={
          <Button variant="secondary" onClick={handleRescan} disabled={rescanning}>
            <FolderSearch className="h-4 w-4" />
            {rescanning ? 'Scanning...' : 'Re-scan ./FILES/api keys'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold">Add Provider API Key</h2>
          </div>
          <form onSubmit={handleAddKey} className="space-y-3">
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Gemini Main Account" required />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label>Provider</Label>
                <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  <option value="GEMINI">GEMINI</option>
                  <option value="GROQ">GROQ</option>
                  <option value="OPENROUTER">OPENROUTER</option>
                  <option value="CUSTOM">CUSTOM (OpenAI)</option>
                  <option value="YOUTUBE">YOUTUBE Data v3</option>
                </Select>
              </div>
              <div>
                <Label>Priority (1 = first)</Label>
                <Input type="number" min={1} max={999} value={priority} onChange={(e) => setPriority(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste key (encrypted on save)"
                required
              />
            </div>
            {provider === 'CUSTOM' && (
              <div>
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
              </div>
            )}
            <div>
              <Label>Default Model (Optional)</Label>
              <Input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="Auto-selects 2026 free chain" />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              <ShieldCheck className="h-4 w-4" />
              {saving ? 'Encrypting...' : 'Encrypt & Store Key'}
            </Button>
          </form>

          <div className="pt-3 border-t space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Router Settings
            </h3>
            <div>
              <Label>Rotation Strategy</Label>
              <Select
                value={strategy}
                onChange={(e) => handleConfigChange(e.target.value as 'PRIORITY_FAILOVER' | 'ROUND_ROBIN', zeroKeyEnabled)}
              >
                <option value="PRIORITY_FAILOVER">Priority Failover (Exhaustion Switching)</option>
                <option value="ROUND_ROBIN">Round Robin Load Balancing</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={zeroKeyEnabled}
                onChange={(e) => handleConfigChange(strategy, e.target.checked)}
                className="rounded border-slate-600"
              />
              Enable Zero-Key Prompt Fallback when all keys exhaust
            </label>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-bold">Stored Keys ({keys.length})</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={fetchVault}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>

            {loading ? (
              <p className="text-xs text-[var(--text-secondary)]">Loading encrypted vault...</p>
            ) : keys.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                No keys stored yet. Add one on the left or click Re-scan ./FILES/api keys.
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((k) => (
                  <div key={k.id} className="rounded-xl border bg-[var(--bg-elevated)] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{k.label}</span>
                        <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-mono font-semibold text-indigo-400">
                          {k.provider}
                        </span>
                        <StatusBadge status={k.status} />
                        {!k.enabled && <StatusBadge status="DISABLED" />}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={testingId === k.id}
                          onClick={() => handleTestKey(k.id)}
                          data-testid={`test-key-${k.provider}`}
                        >
                          <Zap className="h-3.5 w-3.5 text-amber-400" />
                          {testingId === k.id ? 'Testing...' : 'Test Key & Fetch Live Models'}
                        </Button>
                        {k.status !== 'HEALTHY' && (
                          <Button size="sm" variant="ghost" onClick={() => handlePatchKey(k.id, { resetStatus: true })}>
                            <RotateCcw className="h-3.5 w-3.5" /> Reset
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePatchKey(k.id, { enabled: !k.enabled })}
                        >
                          {k.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteKey(k.id)} aria-label="Delete key">
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)] font-mono">
                      <span>Key: {k.maskedKey}</span>
                      <span>Priority: {k.priority}</span>
                      <span>Model: {k.defaultModel || 'auto'}</span>
                      <span>
                        Calls: {k.totalRequests} ({k.totalFailures} fail)
                      </span>
                    </div>

                    {k.lastError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-2.5 py-1.5">{k.lastError}</p>
                    )}

                    {discoveredModels[k.id]?.length ? (
                      <div className="pt-1">
                        <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Live Models Discovered ({discoveredModels[k.id].length})
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {discoveredModels[k.id].slice(0, 18).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handlePatchKey(k.id, { defaultModel: m })}
                              className="rounded-md border px-2 py-0.5 text-[11px] font-mono hover:border-indigo-500"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-bold">Recent Failover & Rotation Logs</h2>
            {logs.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">No failover events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b text-[var(--text-secondary)]">
                      <th className="py-2 pr-3">Task</th>
                      <th className="py-2 pr-3">From</th>
                      <th className="py-2 pr-3">To</th>
                      <th className="py-2 pr-3">Reason</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{log.taskType}</td>
                        <td className="py-2 pr-3 font-mono text-amber-400">
                          {log.fromProvider}/{log.fromModel}
                        </td>
                        <td className="py-2 pr-3 font-mono text-emerald-400">
                          {log.toProvider ? `${log.toProvider}/${log.toModel}` : 'PAUSED_QUOTA'}
                        </td>
                        <td className="py-2 pr-3 max-w-xs truncate">{log.reason}</td>
                        <td className="py-2 text-[var(--text-secondary)]">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
