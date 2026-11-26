'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Flame, MessageSquarePlus, Send } from 'lucide-react';
import { Button, Card, Input, PageHeader } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

interface ChatMsg {
  id: string;
  role: string;
  content: string;
  providerUsed?: string | null;
  modelUsed?: string | null;
}

interface ThreadItem {
  id: string;
  title: string;
  messages: ChatMsg[];
}

const STARTER_CHIPS = [
  'Suggest 5 high-CPM evergreen faceless niches paired with a $15 spreadsheet or ebook.',
  'Write 5 viral 10-second opening hooks for a personal finance stickman video.',
  'Give me 5 memorable channel names for a calm AI history & philosophy channel.',
];

function extractChannelsFromContent(content: string): string[] {
  const found = new Set<string>();
  const tagged = content.match(/\[CHANNEL:\s*([^\]]+)\]/gi) ?? [];
  for (const m of tagged) {
    const clean = m.replace(/^\[CHANNEL:\s*/i, '').replace(/\]$/, '').trim();
    if (clean) found.add(clean);
  }
  return Array.from(found);
}

export default function ViralHookCoachPage() {
  const { pushToast } = useToast();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const loadThreads = async () => {
    const res = await fetch('/api/coach/threads', { cache: 'no-store' });
    const data = await res.json();
    const list = (data.threads ?? []) as ThreadItem[];
    setThreads(list);
    if (!activeThreadId && list.length > 0) {
      setActiveThreadId(list[0].id);
      setMessages(list[0].messages);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  const sendMessage = async (textOverride?: string) => {
    const msg = (textOverride ?? input).trim();
    if (!msg) return;
    setSending(true);
    setInput('');

    const optimisticUser: ChatMsg = { id: `tmp-${Date.now()}`, role: 'user', content: msg };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: activeThreadId, message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setActiveThreadId(data.threadId);
      setMessages((prev) => [...prev, data.message]);
      await loadThreads();
    } catch (err) {
      pushToast({ title: 'Coach reply failed', description: err instanceof Error ? err.message : 'Error', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Coach & Viral Hooks"
        subtitle="Persistent multi-thread strategy coach powered by your Multi-Key Failover Router, with instant YouTube channel availability checks."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveThreadId(undefined);
              setMessages([]);
            }}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> New Thread
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-3 space-y-2 max-h-[620px] overflow-y-auto">
          <div className="text-xs font-bold uppercase text-[var(--text-secondary)]">Saved Threads</div>
          {threads.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Start a chat to save threads locally.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveThreadId(t.id);
                  setMessages(t.messages);
                }}
                className={`w-full text-left rounded-xl px-3 py-2 text-xs truncate border ${
                  t.id === activeThreadId
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.title}
              </button>
            ))
          )}
        </Card>

        <Card className="lg:col-span-9 flex flex-col h-[620px]">
          <div className="flex flex-wrap gap-2 pb-3 border-b">
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                className="rounded-full border bg-[var(--bg-elevated)] px-3 py-1 text-xs hover:border-indigo-500 text-left"
              >
                <Flame className="h-3 w-3 inline mr-1 text-amber-400" />
                {chip}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3" data-testid="coach-messages">
            {messages.length === 0 ? (
              <div className="text-xs text-[var(--text-secondary)] text-center py-12">
                Click any starter chip above or ask for hooks, high-CPM niches, digital products, or channel names.
              </div>
            ) : (
              messages.map((m) => {
                const channels = m.role === 'assistant' ? extractChannelsFromContent(m.content) : [];
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl p-3.5 text-xs whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white ml-auto max-w-[85%]'
                        : 'bg-[var(--bg-elevated)] border mr-auto max-w-[92%]'
                    }`}
                  >
                    <div>{m.content}</div>
                    {channels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t">
                        {channels.map((ch) => (
                          <div key={ch} className="inline-flex items-center gap-1.5 rounded-lg border bg-[var(--bg-surface)] px-2.5 py-1">
                            <span className="font-semibold text-[var(--text-primary)]">{ch}</span>
                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ch)}&sp=EgIQAg%253D%253D`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                            >
                              Check YouTube Availability <ExternalLink className="h-3 w-3" />
                            </a>
                            <a
                              href={`https://tubepilot.ai/tools/youtube-handle-checker/?handle=${encodeURIComponent(ch.replace(/\s+/g, ''))}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                            >
                              TubePilot <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.providerUsed && (
                      <div className="text-[10px] text-[var(--text-secondary)] mt-1.5 font-mono">
                        {m.providerUsed} / {m.modelUsed}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="pt-3 border-t flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for viral hooks, niches, product angles, or channel name ideas..."
              data-testid="coach-input"
            />
            <Button type="submit" disabled={sending} data-testid="coach-send">
              <Send className="h-4 w-4" />
              {sending ? 'Thinking...' : 'Send'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
