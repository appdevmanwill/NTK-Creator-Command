import { nativeHttpRequest } from './bridge';
import { loadMobileKeys, MobileApiKey, saveMobileKeys } from './storage';

const MODEL_CHAINS: Record<MobileApiKey['provider'], string[]> = {
  GEMINI: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen'],
  GROQ: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
  OPENROUTER: ['openrouter/free', 'google/gemma-4-26b-a4b:free', 'nvidia/nemotron-3.5-lightning:free'],
  CUSTOM: ['gpt-4o-mini'],
  YOUTUBE: ['youtube-data-v3'],
};

export function maskKey(key: string): string {
  const t = key.trim();
  if (t.length <= 10) return `${t.slice(0, 2)}***${t.slice(-2)}`;
  return `${t.slice(0, 5)}...${t.slice(-4)}`;
}

async function callProvider(
  key: MobileApiKey,
  model: string,
  prompt: string,
  jsonMode: boolean
): Promise<{ ok: boolean; status: number; text: string; error?: string }> {
  if (key.provider === 'GEMINI') {
    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };
    const resp = await nativeHttpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return { ok: false, status: resp.status, text: '', error: resp.error || resp.body.slice(0, 200) };
    }
    try {
      const parsed = JSON.parse(resp.body) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
      };
      const parts = parsed.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p) => typeof p.text === 'string' && p.thought !== true)
        .map((p) => p.text || '')
        .join('')
        .trim();
      return text
        ? { ok: true, status: 200, text }
        : { ok: false, status: 502, text: '', error: 'Empty response' };
    } catch {
      return { ok: false, status: 502, text: '', error: 'Invalid JSON from Gemini' };
    }
  }

  const endpoint =
    key.provider === 'GROQ'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : key.provider === 'OPENROUTER'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : `${(key.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;

  const resp = await nativeHttpRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 2048,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!resp.ok) {
    return { ok: false, status: resp.status, text: '', error: resp.error || resp.body.slice(0, 200) };
  }
  try {
    const parsed = JSON.parse(resp.body) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = parsed.choices?.[0]?.message?.content?.trim() || '';
    return text
      ? { ok: true, status: 200, text }
      : { ok: false, status: 502, text: '', error: 'Empty response' };
  } catch {
    return { ok: false, status: 502, text: '', error: 'Invalid JSON from provider' };
  }
}

export async function generateMobileAI(
  prompt: string,
  jsonMode = false
): Promise<{ ok: boolean; text?: string; providerSummary: string; zeroKeyPrompt: string }> {
  const keys = loadMobileKeys().filter((k) => k.enabled && k.provider !== 'YOUTUBE');
  keys.sort((a, b) => a.priority - b.priority);

  const now = Date.now();
  const updatedKeys = [...keys];

  for (let i = 0; i < updatedKeys.length; i++) {
    const k = updatedKeys[i];
    if (k.status === 'INVALID') continue;
    if (k.status === 'COOLDOWN' && k.cooldownUntil && k.cooldownUntil > now) continue;

    const chain = k.defaultModel
      ? [k.defaultModel, ...MODEL_CHAINS[k.provider].filter((m) => m !== k.defaultModel)]
      : MODEL_CHAINS[k.provider];

    for (const model of chain) {
      const res = await callProvider(k, model, prompt, jsonMode);
      if (res.ok && res.text) {
        updatedKeys[i] = { ...k, status: 'HEALTHY', cooldownUntil: null, lastError: null };
        saveAllUpdated(updatedKeys);
        return { ok: true, text: res.text, providerSummary: `${k.provider}/${model}`, zeroKeyPrompt: prompt };
      }
      if (res.status === 401 || res.status === 403) {
        updatedKeys[i] = { ...k, status: 'INVALID', lastError: res.error || `HTTP ${res.status}` };
        break;
      }
      updatedKeys[i] = {
        ...k,
        status: 'COOLDOWN',
        cooldownUntil: Date.now() + 65000,
        lastError: res.error || `HTTP ${res.status}`,
      };
    }
  }

  saveAllUpdated(updatedKeys);
  return { ok: false, providerSummary: 'Built-in Template / Zero-Key', zeroKeyPrompt: prompt };
}

function saveAllUpdated(updatedSubset: MobileApiKey[]): void {
  const all = loadMobileKeys();
  const merged = all.map((orig) => updatedSubset.find((u) => u.id === orig.id) || orig);
  saveMobileKeys(merged);
}

export async function testMobileKey(key: MobileApiKey): Promise<{ ok: boolean; message: string }> {
  if (key.provider === 'YOUTUBE') {
    const resp = await nativeHttpRequest(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=1&key=${encodeURIComponent(key.apiKey)}`
    );
    return resp.ok
      ? { ok: true, message: 'YouTube Data v3 verified (200 OK)' }
      : { ok: false, message: resp.error || `HTTP ${resp.status}` };
  }
  const model = key.defaultModel || MODEL_CHAINS[key.provider][0];
  const res = await callProvider(key, model, 'Reply with OK', false);
  return res.ok
    ? { ok: true, message: `Connected via ${model}` }
    : { ok: false, message: res.error || `HTTP ${res.status}` };
}

export function extractJsonSafe<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
