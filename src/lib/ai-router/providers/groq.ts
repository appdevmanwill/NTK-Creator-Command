import { ProviderCallParams, ProviderHttpError, ProviderTestResult } from '../types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MAX_CHARS_PER_CHUNK = 18000;

function headersToRecord(headers: Headers): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((v, k) => {
    rec[k.toLowerCase()] = v;
  });
  return rec;
}

function parseResetSeconds(headers: Record<string, string>): number | undefined {
  const raw =
    headers['retry-after'] ||
    headers['x-ratelimit-reset-requests'] ||
    headers['x-ratelimit-reset-tokens'];
  if (!raw) return undefined;
  const num = Number(raw);
  if (!Number.isNaN(num) && num > 0) return Math.ceil(num);
  const m = raw.match(/(\d+(?:\.\d+)?)m?(\d+(?:\.\d+)?)s/i);
  if (m) return Math.ceil(Number(m[1]) * 60 + Number(m[2]));
  const s = raw.match(/(\d+(?:\.\d+)?)s/i);
  if (s) return Math.ceil(Number(s[1]));
  return undefined;
}

async function singleGroqCall(
  apiKey: string,
  model: string,
  prompt: string,
  systemPrompt?: string,
  jsonMode?: boolean,
  temperature?: number,
  maxTokens?: number,
  timeoutMs = 28000
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt?.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: temperature ?? 0.6,
    max_tokens: maxTokens ?? 3500,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let resp: Response;
  try {
    resp = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderHttpError({
      status: 503,
      message: `Groq network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      retryAfterSeconds: 20,
    });
  }

  const rawBody = await resp.text();
  if (!resp.ok) {
    const headers = headersToRecord(resp.headers);
    let msg = `Groq HTTP ${resp.status}`;
    try {
      const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (rawBody) msg = rawBody.slice(0, 300);
    }
    throw new ProviderHttpError({
      status: resp.status,
      message: msg,
      retryAfterSeconds: parseResetSeconds(headers),
      headers,
      rawBody: rawBody.slice(0, 600),
    });
  }

  const parsed = JSON.parse(rawBody) as {
    choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
  };
  const msg = parsed.choices?.[0]?.message;
  const content = (msg?.content?.trim() || (maxTokens && maxTokens <= 256 ? msg?.reasoning?.trim() : '') || '').trim();
  if (!content) {
    throw new ProviderHttpError({
      status: 502,
      message: `Groq (${model}) returned empty content`,
      retryAfterSeconds: 15,
    });
  }
  return content;
}

export async function callGroqGenerate(params: ProviderCallParams): Promise<string> {
  if (params.images?.length) {
    throw new ProviderHttpError({
      status: 400,
      message: 'Groq text-only route skipped for vision payload',
    });
  }
  const model = params.model || 'openai/gpt-oss-120b';

  // Automatic chunking under Groq 8,000 TPM free limit
  if (params.prompt.length <= GROQ_MAX_CHARS_PER_CHUNK) {
    return singleGroqCall(
      params.apiKey,
      model,
      params.prompt,
      params.systemPrompt,
      params.jsonMode,
      params.temperature,
      params.maxOutputTokens,
      params.timeoutMs
    );
  }

  const chunks: string[] = [];
  for (let i = 0; i < params.prompt.length; i += GROQ_MAX_CHARS_PER_CHUNK) {
    chunks.push(params.prompt.slice(i, i + GROQ_MAX_CHARS_PER_CHUNK));
  }

  const summaries: string[] = [];
  for (let idx = 0; idx < chunks.length - 1; idx++) {
    const partSummary = await singleGroqCall(
      params.apiKey,
      model,
      `Condense key facts, entities, and instructions from part ${idx + 1}/${chunks.length} without losing details:\n\n${chunks[idx]}`,
      'Extract concise structured context.',
      false,
      0.2,
      1024,
      params.timeoutMs
    );
    summaries.push(`[Context Part ${idx + 1}]\n${partSummary}`);
  }

  const finalPrompt = `${summaries.join('\n\n')}\n\n[Final Instruction & Payload]\n${chunks[chunks.length - 1]}`;
  return singleGroqCall(
    params.apiKey,
    model,
    finalPrompt,
    params.systemPrompt,
    params.jsonMode,
    params.temperature,
    params.maxOutputTokens,
    params.timeoutMs
  );
}

export async function testAndListGroqModels(
  apiKey: string,
  preferredModel?: string | null
): Promise<ProviderTestResult> {
  const start = Date.now();
  let models: string[] = [];
  try {
    const resp = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { data?: Array<{ id?: string }> };
      models = (data.data ?? []).map((m) => m.id ?? '').filter(Boolean);
    }
  } catch {
    // ignore
  }

  const candidates = [
    ...(preferredModel?.trim() ? [preferredModel.trim()] : []),
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'allam-2-7b',
  ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  let lastErr = 'Unable to reach Groq chat completions';
  for (const candidate of candidates) {
    try {
      const reply = await singleGroqCall(apiKey, candidate, 'Reply with OK', undefined, false, 0, 256, 15000);
      return {
        ok: true,
        provider: 'GROQ',
        testedModel: candidate,
        models,
        message: `Connected via ${candidate} ("${reply.slice(0, 32)}")`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (err instanceof ProviderHttpError && (err.status === 401 || err.status === 403)) {
        break;
      }
    }
  }

  return {
    ok: false,
    provider: 'GROQ',
    testedModel: candidates[0] ?? 'openai/gpt-oss-120b',
    models,
    message: lastErr,
    latencyMs: Date.now() - start,
  };
}
