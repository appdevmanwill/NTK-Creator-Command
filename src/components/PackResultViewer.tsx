'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Download,
  FileCode,
  FileText,
  FolderOpen,
  AlertTriangle,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { Button, Card, Textarea } from './ui';
import { useToast } from './ToastProvider';

export interface PackFilePreview {
  path: string;
  content: string;
}

export interface TriggerPromptOption {
  label: string;
  prompt: string;
}

export interface PausedQuotaState {
  jobId: string;
  completedSteps: number;
  totalSteps: number;
  retryAfterSeconds?: number;
  zeroKeyRemainingPrompt?: string;
  error?: string;
}

export function PackResultViewer({
  projectId,
  title,
  files,
  triggerPrompts = [],
  providerSummary,
  pausedQuota,
  onRetryResume,
  onZeroKeyImported,
}: {
  projectId?: string;
  title: string;
  files: PackFilePreview[];
  triggerPrompts?: TriggerPromptOption[];
  providerSummary?: string;
  pausedQuota?: PausedQuotaState | null;
  onRetryResume?: () => void;
  onZeroKeyImported?: (pasted: string) => Promise<void>;
}) {
  const { pushToast } = useToast();
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path ?? '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zeroKeyPaste, setZeroKeyPaste] = useState('');
  const [importingZeroKey, setImportingZeroKey] = useState(false);

  const activeFile = files.find((f) => f.path === selectedPath) ?? files[0];

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    pushToast({ title: 'Copied to clipboard', tone: 'success' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (pausedQuota) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Paused Cleanly at Checkpoint ({pausedQuota.completedSteps}/{pausedQuota.totalSteps} steps saved)
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {pausedQuota.error || 'All keys across configured providers hit rate/daily limits.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onRetryResume && (
              <Button onClick={onRetryResume} size="sm">
                <RefreshCw className="h-3.5 w-3.5" /> Auto-Retry / Resume ({pausedQuota.retryAfterSeconds ?? 65}s)
              </Button>
            )}
            <Link href="/admin/keys">
              <Button variant="secondary" size="sm">
                <KeyRound className="h-3.5 w-3.5" /> Add Key & Resume
              </Button>
            </Link>
          </div>
        </div>

        {pausedQuota.zeroKeyRemainingPrompt && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-amber-400">
                Zero-Key Prompt for Remaining Steps Only
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyText('paused-zk', pausedQuota.zeroKeyRemainingPrompt!)}
              >
                {copiedId === 'paused-zk' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Remaining Prompt
              </Button>
            </div>
            <pre className="max-h-56 overflow-auto rounded-xl border bg-[var(--bg-elevated)] p-3 text-xs font-mono whitespace-pre-wrap">
              {pausedQuota.zeroKeyRemainingPrompt}
            </pre>
            {onZeroKeyImported && (
              <div className="space-y-2 pt-2">
                <Textarea
                  rows={4}
                  placeholder="Paste AI response from Gemini/ChatGPT here to complete the remaining steps..."
                  value={zeroKeyPaste}
                  onChange={(e) => setZeroKeyPaste(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!zeroKeyPaste.trim() || importingZeroKey}
                  onClick={async () => {
                    setImportingZeroKey(true);
                    try {
                      await onZeroKeyImported(zeroKeyPaste);
                    } finally {
                      setImportingZeroKey(false);
                    }
                  }}
                >
                  Import Pasted Response & Finish
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  if (!files.length) return null;

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
            {providerSummary && (
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Generated via {providerSummary}</p>
            )}
          </div>
          {projectId && (
            <a href={`/api/projects/${projectId}/download`} download>
              <Button>
                <Download className="h-4 w-4" /> Download .ZIP Pack
              </Button>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 rounded-xl border bg-[var(--bg-elevated)] p-3 max-h-96 overflow-y-auto">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2 px-1">
              <FolderOpen className="h-3.5 w-3.5" /> Pack Files ({files.length})
            </div>
            <div className="space-y-1">
              {files.map((f) => {
                const active = f.path === activeFile?.path;
                const isCode = f.path.endsWith('.json') || f.path.endsWith('.ipynb') || f.path.endsWith('.py');
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedPath(f.path)}
                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-mono transition ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {isCode ? <FileCode className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{f.path}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border bg-[var(--bg-elevated)] flex flex-col max-h-96">
            <div className="flex items-center justify-between border-b px-3.5 py-2">
              <span className="text-xs font-mono font-semibold text-[var(--text-primary)] truncate">
                {activeFile?.path}
              </span>
              {activeFile && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyText(`file-${activeFile.path}`, activeFile.content)}
                >
                  {copiedId === `file-${activeFile.path}` ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy File
                </Button>
              )}
            </div>
            <pre className="p-4 text-xs font-mono overflow-auto whitespace-pre-wrap text-[var(--text-primary)] leading-relaxed flex-1">
              {activeFile?.content}
            </pre>
          </div>
        </div>
      </Card>

      {triggerPrompts.length > 0 && (
        <Card className="space-y-3">
          <h4 className="text-sm font-bold text-[var(--text-primary)]">
            1-Click Antigravity / Codex Trigger Prompts
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {triggerPrompts.map((tp, idx) => (
              <div key={tp.label} className="rounded-xl border bg-[var(--bg-elevated)] p-3 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-indigo-400">{tp.label}</span>
                    <button
                      type="button"
                      onClick={() => copyText(`tp-${idx}`, tp.prompt)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] hover:border-indigo-500/50"
                    >
                      {copiedId === `tp-${idx}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-5 font-mono">
                    {tp.prompt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
