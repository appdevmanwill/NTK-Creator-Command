import { ProviderCallParams, ProviderHttpError, ProviderTestResult } from '../types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function normalizeModelId(model: string): string {
  return model.replace(/^models\//, '').trim();
}

function headersToRecord(headers: Headers): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((v, k) => {
    rec[k.toLowerCase()] = v;
  });
  return rec;
}

function parseRetryAfter(headers: Record<string, string>, bodyText: string): number | undefined {
  const ra = headers['retry-after'];
  if (ra) {
    const secs = Number(ra);
    if (!Number.isNaN(secs) && secs > 0) return Math.ceil(secs);
  }
  const m = bodyText.match(/retry\s*(?:in|after)\s*(\d+(?:\.\d+)?)\s*s/i);
  if (m?.[1]) return Math.ceil(Number(m[1]));
  return undefined;
}

function extractGeminiText(data: unknown): string {
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  const visible = parts
    .filter((p) => typeof p.text === 'string' && p.thought !== true)
    .map((p) => p.text as string)
    .join('');
  if (visible.trim()) return visible.trim();
  // Fallback if all parts lacked text or were tagged differently
  const anyText = parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
    .trim();
  return anyText;
}

export async function callGeminiGenerate(params: ProviderCallParams): Promise<string> {
  const model = normalizeModelId(params.model || 'gemini-3.8-flash');
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  const parts: Array<Record<string, unknown>> = [];
  if (params.images?.length) {
    for (const img of params.images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Data,
        },
      });
    }
  }
  parts.push({ text: params.prompt });

  const buildBody = (includeThinkingBudgetZero: boolean): Record<string, unknown> => {
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: Math.max(params.maxOutputTokens ?? 4096, 256),
      temperature: params.temperature ?? 0.6,
    };
    if (params.jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }
    if (includeThinkingBudgetZero) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload: Record<string, unknown> = {
      contents: [{ role: 'user', parts }],
      generationConfig,
    };
    if (params.systemPrompt?.trim()) {
      payload.systemInstruction = {
        parts: [{ text: params.systemPrompt.trim() }],
      };
    }
    return payload;
  };

  const sendRequest = async (includeThinkingBudgetZero: boolean): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': params.apiKey,
        },
        body: JSON.stringify(buildBody(includeThinkingBudgetZero)),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error calling Gemini';
      throw new ProviderHttpError({
        status: 503,
        message: `Gemini connection error (${model}): ${msg}`,
        retryAfterSeconds: 20,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const isLowTokenPing = (params.maxOutputTokens ?? 4096) <= 512;
  let resp = await sendRequest(isLowTokenPing);
  if (resp.status === 400 && isLowTokenPing) {
    resp = await sendRequest(false);
  }

  const rawBody = await resp.text();
  if (!resp.ok) {
    const headers = headersToRecord(resp.headers);
    let msg = `Gemini HTTP ${resp.status}`;
    try {
      const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (rawBody) msg = rawBody.slice(0, 300);
    }
    throw new ProviderHttpError({
      status: resp.status,
      message: msg,
      retryAfterSeconds: parseRetryAfter(headers, rawBody),
      headers,
      rawBody: rawBody.slice(0, 600),
    });
  }

  const parsed = JSON.parse(rawBody);
  const text = extractGeminiText(parsed);
  if (!text) {
    throw new ProviderHttpError({
      status: 502,
      message: `Gemini (${model}) returned empty visible text`,
      retryAfterSeconds: 15,
      rawBody: rawBody.slice(0, 400),
    });
  }
  return text;
}

export async function testAndListGeminiModels(
  apiKey: string,
  preferredModel?: string | null
): Promise<ProviderTestResult> {
  const start = Date.now();
  let models: string[] = [];
  try {
    const listResp = await fetch(`${GEMINI_BASE}/models?pageSize=100`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (listResp.ok) {
      const data = (await listResp.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      };
      models = (data.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => normalizeModelId(m.name ?? ''))
        .filter(Boolean);
    }
  } catch {
    // Continue to live generateContent probe
  }

  const candidates = [
    ...(preferredModel ? [normalizeModelId(preferredModel)] : []),
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-4-hydrogen',
  ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

  let lastErr = 'Unable to reach Gemini generateContent';
  for (const candidate of candidates) {
    try {
      const reply = await callGeminiGenerate({
        apiKey,
        model: candidate,
        prompt: 'Reply with OK',
        maxOutputTokens: 256,
        temperature: 0,
        timeoutMs: 18000,
      });
      return {
        ok: true,
        provider: 'GEMINI',
        testedModel: candidate,
        models: models.length ? models : candidates,
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
    provider: 'GEMINI',
    testedModel: candidates[0] ?? 'gemini-3.8-flash',
    models,
    message: lastErr,
    latencyMs: Date.now() - start,
  };
}
