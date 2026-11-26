import { ProviderCallParams, ProviderHttpError, ProviderTestResult } from '../types';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function headersToRecord(headers: Headers): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((v, k) => {
    rec[k.toLowerCase()] = v;
  });
  return rec;
}

export async function callOpenRouterGenerate(params: ProviderCallParams): Promise<string> {
  const model = params.model || 'openrouter/free';
  const messages: Array<Record<string, unknown>> = [];
  if (params.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt.trim() });
  }

  if (params.images?.length) {
    const contentParts: Array<Record<string, unknown>> = [{ type: 'text', text: params.prompt }];
    for (const img of params.images) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` },
      });
    }
    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: params.prompt });
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: params.temperature ?? 0.6,
    max_tokens: params.maxOutputTokens ?? 4096,
  };
  if (params.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let resp: Response;
  try {
    resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'NTK Creator Command',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(params.timeoutMs ?? 30000),
    });
  } catch (err) {
    throw new ProviderHttpError({
      status: 503,
      message: `OpenRouter network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      retryAfterSeconds: 20,
    });
  }

  const rawBody = await resp.text();
  if (!resp.ok) {
    const headers = headersToRecord(resp.headers);
    let msg = `OpenRouter HTTP ${resp.status}`;
    try {
      const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (rawBody) msg = rawBody.slice(0, 300);
    }
    const retryAfter = headers['retry-after'] ? Number(headers['retry-after']) : undefined;
    throw new ProviderHttpError({
      status: resp.status,
      message: msg,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
      headers,
      rawBody: rawBody.slice(0, 600),
    });
  }

  const parsed = JSON.parse(rawBody) as {
    choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
  };
  const msg = parsed.choices?.[0]?.message;
  const content = (
    msg?.content?.trim() ||
    (params.maxOutputTokens && params.maxOutputTokens <= 256 ? msg?.reasoning?.trim() : '') ||
    ''
  ).trim();
  if (!content) {
    throw new ProviderHttpError({
      status: 502,
      message: `OpenRouter (${model}) returned empty content`,
      retryAfterSeconds: 15,
    });
  }
  return content;
}

export async function testAndListOpenRouterModels(
  apiKey: string,
  preferredModel?: string | null
): Promise<ProviderTestResult> {
  const start = Date.now();
  let models: string[] = [];
  try {
    const resp = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { data?: Array<{ id?: string }> };
      models = (data.data ?? [])
        .map((m) => m.id ?? '')
        .filter((id) => id === 'openrouter/free' || id.endsWith(':free'));
    }
  } catch {
    // ignore
  }

  const candidates = [
    ...(preferredModel?.trim() ? [preferredModel.trim()] : []),
    'openrouter/free',
    'google/gemma-4-26b-a4b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3.5-super-vl:free',
    ...models.slice(0, 4),
  ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  let lastErr = 'Unable to reach OpenRouter chat completions';
  for (const candidate of candidates) {
    try {
      const reply = await callOpenRouterGenerate({
        apiKey,
        model: candidate,
        prompt: 'Reply with OK',
        maxOutputTokens: 256,
        temperature: 0,
        timeoutMs: 20000,
      });
      return {
        ok: true,
        provider: 'OPENROUTER',
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
    provider: 'OPENROUTER',
    testedModel: candidates[0] ?? 'openrouter/free',
    models,
    message: lastErr,
    latencyMs: Date.now() - start,
  };
}
